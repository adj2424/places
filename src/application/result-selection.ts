import type { Lead, SelectionSource } from "../domain/model/lead.js";
import { isQualified } from "../domain/model/lead.js";

export interface SelectedLead extends Lead {
  readonly selectionSource: SelectionSource;
}

/**
 * Cap the response and mix in a random holdout so scoring weights can be
 * disconfirmed rather than only confirmed. Drawn leads come from outside the
 * top-by-score set.
 */
export function selectResults(
  leads: readonly Lead[],
  options: {
    readonly cap: number;
    readonly holdoutFraction: number;
    readonly random?: () => number;
  },
): SelectedLead[] {
  const qualified = leads
    .filter(isQualified)
    .filter((lead) => lead.score !== null)
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (qualified.length === 0) return [];

  const cap = Math.min(options.cap, qualified.length);
  const drawCount = Math.min(
    Math.floor(options.cap * options.holdoutFraction),
    Math.max(0, qualified.length - 1),
    cap,
  );
  const rankCount = cap - drawCount;
  const random = options.random ?? Math.random;

  const ranked = qualified.slice(0, rankCount).map(
    (lead): SelectedLead => ({ ...lead, selectionSource: "rank" }),
  );

  const outside = qualified.slice(rankCount);
  const drawn: SelectedLead[] = [];
  const pool = outside.slice();

  while (drawn.length < drawCount && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    const [picked] = pool.splice(index, 1);
    if (!picked) break;
    drawn.push({ ...picked, selectionSource: "draw" });
  }

  // Non-draw entries stay in descending score order; draws append after.
  return [...ranked, ...drawn];
}
