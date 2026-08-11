import type { AppConfig } from "../config/index.js";
import { DEFAULT_SCORE_WEIGHTS } from "../config/score-weights.js";
import type { Coordinates, QueryCircle } from "../domain/model/geo.js";
import type { Lead, WebsiteStatus } from "../domain/model/lead.js";
import type { Place } from "../domain/model/place.js";
import type { ProbeEvidence } from "../domain/model/probe-evidence.js";
import { classify } from "../domain/qualification/segment.js";
import { scoreLead } from "../domain/scoring/score.js";
import { QuadtreeSweep } from "../domain/tiling/quadtree.js";
import type { CoverageRepository } from "./ports/coverage-repository.js";
import type { Geocoder } from "./ports/geocoder.js";
import type { LeadRepository } from "./ports/lead-repository.js";
import type { PlaceDiscovery } from "./ports/place-discovery.js";
import type { WebsiteProbe } from "./ports/website-probe.js";
import { selectResults, type SelectedLead } from "./result-selection.js";

export type SweepOrigin =
  | { readonly kind: "coordinates"; readonly coordinates: Coordinates }
  | { readonly kind: "address"; readonly address: string };

export interface SweepRequest {
  readonly origin: SweepOrigin;
  readonly radiusMeters: number;
}

export interface SweepResult {
  readonly placeIds: readonly string[];
  readonly leads: readonly SelectedLead[];
  readonly incomplete: boolean;
  readonly cellsQueried: number;
  readonly cellsSkipped: number;
}

export class SweepValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SweepValidationError";
  }
}

export class SweepAmbiguityError extends Error {
  readonly candidates: readonly string[];

  constructor(candidates: readonly string[]) {
    super("Address matched multiple locations");
    this.name = "SweepAmbiguityError";
    this.candidates = candidates;
  }
}

export class SweepUnresolvableError extends Error {
  constructor() {
    super("Address could not be resolved");
    this.name = "SweepUnresolvableError";
  }
}

export interface SweepServiceDeps {
  readonly config: AppConfig;
  readonly geocoder: Geocoder;
  readonly discovery: PlaceDiscovery;
  readonly probe: WebsiteProbe;
  readonly leads: LeadRepository;
  readonly coverage: CoverageRepository;
  readonly now?: () => Date;
  readonly random?: () => number;
}

const CHAIN_FREQUENCY_THRESHOLD = 3;

export class SweepService {
  readonly #config: AppConfig;
  readonly #geocoder: Geocoder;
  readonly #discovery: PlaceDiscovery;
  readonly #probe: WebsiteProbe;
  readonly #leads: LeadRepository;
  readonly #coverage: CoverageRepository;
  readonly #now: () => Date;
  readonly #random: () => number;

  constructor(deps: SweepServiceDeps) {
    this.#config = deps.config;
    this.#geocoder = deps.geocoder;
    this.#discovery = deps.discovery;
    this.#probe = deps.probe;
    this.#leads = deps.leads;
    this.#coverage = deps.coverage;
    this.#now = deps.now ?? (() => new Date());
    this.#random = deps.random ?? Math.random;
  }

  async run(request: SweepRequest): Promise<SweepResult> {
    if (request.radiusMeters <= 0) {
      throw new SweepValidationError("radiusMeters must be positive");
    }
    if (request.radiusMeters > this.#config.sweep.radiusCeilingMeters) {
      throw new SweepValidationError(
        `radiusMeters exceeds ceiling of ${this.#config.sweep.radiusCeilingMeters}`,
      );
    }

    const center = await this.#resolveCenter(request.origin);
    const root: QueryCircle = {
      center,
      radiusMeters: request.radiusMeters,
    };

    const started = this.#now();
    const deadline =
      started.getTime() + this.#config.sweep.wallClockBudgetMs;
    const discoveryFreshSince = daysAgo(
      started,
      this.#config.freshness.discoveryDays,
    );
    const verificationFreshBefore = daysAgo(
      started,
      this.#config.freshness.verificationDays,
    );

    const covered = await this.#coverage.listFreshCircles(discoveryFreshSince);
    const tree = new QuadtreeSweep({
      root,
      minCellSizeMeters: this.#config.sweep.minCellSizeMeters,
      requestBudget: this.#config.sweep.requestBudget,
      coveredCircles: covered,
    });

    const discovered = new Map<string, Place>();
    const sweptAt = this.#now();
    const recordedCells: Array<{
      circle: QueryCircle;
      incomplete: boolean;
    }> = [];
    let wallClockHit = false;

    for (;;) {
      if (this.#now().getTime() >= deadline) {
        wallClockHit = true;
        break;
      }

      const cell = tree.nextCell();
      if (cell === null) break;

      try {
        const result = await this.#discovery.discover(cell.circle);
        for (const place of result.places) {
          discovered.set(place.placeId, place);
        }

        const saturated = result.passes.some(
          (pass) => pass.resultCount >= pass.perRequestMaximum,
        );
        tree.reportSaturation(cell, saturated);
        recordedCells.push({ circle: cell.circle, incomplete: false });
      } catch (error) {
        recordedCells.push({ circle: cell.circle, incomplete: true });
        tree.reportSaturation(cell, false);
        if (isQuotaError(error)) throw error;
        // Continue the sweep for non-quota discovery failures on one cell.
      }
    }

    const incompleteKeys = new Set(
      tree.incompleteCells.map(circleKey),
    );

    await this.#coverage.recordSweptCells(
      recordedCells.map((cell) => ({
        circle: cell.circle,
        sweptAt,
        incomplete: cell.incomplete || incompleteKeys.has(circleKey(cell)),
      })),
    );

    const stale = await this.#leads.findStaleVerifications(
      verificationFreshBefore,
      500,
    );
    for (const stored of stale) {
      if (!discovered.has(stored.place.placeId)) {
        discovered.set(stored.place.placeId, stored.place);
      }
    }

    const evaluated = await this.#evaluatePlaces([...discovered.values()]);
    await this.#leads.upsertMany(evaluated);
    const afterChains = await this.#applyChainFrequency(evaluated);

    const selected = selectResults(afterChains, {
      cap: this.#config.response.cap,
      holdoutFraction: this.#config.response.holdoutFraction,
      random: this.#random,
    });

    if (selected.length > 0) {
      await this.#leads.upsertMany(selected);
    }

    const incomplete =
      wallClockHit ||
      tree.budgetExhausted ||
      tree.incompleteCells.length > 0 ||
      recordedCells.some((cell) => cell.incomplete);

    return {
      placeIds: selected.map((lead) => lead.place.placeId),
      leads: selected,
      incomplete,
      cellsQueried: tree.cellsQueried,
      cellsSkipped: tree.cellsSkipped,
    };
  }

  async #resolveCenter(origin: SweepOrigin): Promise<Coordinates> {
    if (origin.kind === "coordinates") return origin.coordinates;

    const result = await this.#geocoder.resolve(origin.address);
    if (result.kind === "resolved") return result.coordinates;
    if (result.kind === "ambiguous") {
      throw new SweepAmbiguityError(result.candidates);
    }
    throw new SweepUnresolvableError();
  }

  async #evaluatePlaces(places: readonly Place[]): Promise<Lead[]> {
    const verifiedAt = this.#now().toISOString();
    const thresholds = {
      maxResponseMs: this.#config.quality.maxResponseMs,
      minBodyBytes: this.#config.quality.minBodyBytes,
    };

    const leads: Lead[] = [];

    await mapPool(places, this.#config.probe.concurrency, async (place) => {
      let evidence: ProbeEvidence | null = null;
      let email: string | null = null;
      let websiteStatus: WebsiteStatus = "none_listed";

      try {
        if (place.websiteUri !== null && place.websiteUri.trim() !== "") {
          evidence = await this.#probe.probe(place.websiteUri);
          email = evidence.email;
          websiteStatus = deriveWebsiteStatus(evidence);
        }
      } catch (error) {
        evidence = {
          url: place.websiteUri ?? "",
          dns: {
            kind: "transport_failure",
            detail: error instanceof Error ? error.message : String(error),
          },
          http: null,
          email: null,
        };
        websiteStatus = "transport_failure";
      }

      const classification = classify(place, evidence, thresholds);

      if (classification.kind === "excluded") {
        leads.push({
          place,
          segment: null,
          exclusionReason: classification.reason,
          websiteStatus,
          email,
          score: null,
          breakdown: null,
          selectionSource: null,
          verifiedAt,
        });
        return;
      }

      if (classification.kind === "unverified") {
        leads.push({
          place,
          segment: null,
          exclusionReason: null,
          websiteStatus: "transport_failure",
          email,
          score: null,
          breakdown: null,
          selectionSource: null,
          verifiedAt,
        });
        return;
      }

      if (classification.kind === "not_a_lead") {
        leads.push({
          place,
          segment: null,
          exclusionReason: null,
          websiteStatus,
          email,
          score: null,
          breakdown: null,
          selectionSource: null,
          verifiedAt,
        });
        return;
      }

      const breakdown = scoreLead(
        {
          userRatingCount: place.userRatingCount,
          rating: place.rating,
          segment: classification.segment,
          hasRegisteredButDeadDomain:
            classification.segment === "parked_or_dead" &&
            place.websiteUri !== null,
        },
        DEFAULT_SCORE_WEIGHTS,
      );

      leads.push({
        place,
        segment: classification.segment,
        exclusionReason: null,
        websiteStatus,
        email,
        score: breakdown.total,
        breakdown,
        selectionSource: null,
        verifiedAt,
      });
    });

    return leads;
  }

  async #applyChainFrequency(evaluated: readonly Lead[]): Promise<Lead[]> {
    const counts = await this.#leads.countNormalizedNames();
    const corpusCounts = new Map(
      counts.map((row) => [row.normalizedName, row.distinctLocations]),
    );

    const sweepLocations = new Map<string, Set<string>>();
    for (const lead of evaluated) {
      const key = normalizeName(lead.place.displayName);
      const locations = sweepLocations.get(key) ?? new Set<string>();
      locations.add(locationKey(lead.place));
      sweepLocations.set(key, locations);
    }

    const chainNames = new Set<string>();
    for (const [name, locations] of sweepLocations) {
      // After upsert the corpus read should include this sweep; take the max so
      // a three-location hit in one pass is caught even if the RPC lags.
      const total = Math.max(corpusCounts.get(name) ?? 0, locations.size);
      if (total >= CHAIN_FREQUENCY_THRESHOLD) chainNames.add(name);
    }
    for (const [name, distinct] of corpusCounts) {
      if (distinct >= CHAIN_FREQUENCY_THRESHOLD) chainNames.add(name);
    }

    const toExclude = new Set(
      evaluated
        .filter((lead) => chainNames.has(normalizeName(lead.place.displayName)))
        .map((lead) => lead.place.placeId),
    );

    if (toExclude.size > 0) {
      await this.#leads.excludeByPlaceId([...toExclude], "chain");
    }

    return evaluated.map((lead) =>
      toExclude.has(lead.place.placeId)
        ? {
            ...lead,
            segment: null,
            exclusionReason: "chain",
            score: null,
            breakdown: null,
            selectionSource: null,
          }
        : lead,
    );
  }
}

function deriveWebsiteStatus(evidence: ProbeEvidence): WebsiteStatus {
  if (evidence.dns.kind === "transport_failure") return "transport_failure";
  if (evidence.dns.kind === "no_record") return "unresolvable";
  if (evidence.http === null) return "parked";
  if (evidence.http.kind === "transport_failure") return "transport_failure";
  if (evidence.http.matchedFingerprint !== null) return "stub";
  return "live";
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function locationKey(place: Place): string {
  if (place.coordinates) {
    return `${place.coordinates.latitude.toFixed(5)},${place.coordinates.longitude.toFixed(5)}`;
  }
  return place.placeId;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function circleKey(cell: {
  readonly circle: QueryCircle;
}): string {
  return `${cell.circle.center.latitude}:${cell.circle.center.longitude}:${cell.circle.radiusMeters}`;
}

function isQuotaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name: string }).name === "PlacesQuotaError" ||
      (error as { name: string }).name === "QuotaExhaustedError")
  );
}

async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      for (;;) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}
