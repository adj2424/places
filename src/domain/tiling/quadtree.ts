import type { Coordinates, QueryCircle } from "../model/geo.js";
import {
  childSquares,
  circleFullyContains,
  circumscribedRadiusMeters,
  offsetToCoordinates,
  squareIntersectsOriginCircle,
  type SquareMeters,
} from "./geometry.js";

export interface TilingOptions {
  /** The area the caller asked for. Its centre is the metre plane's origin. */
  readonly root: QueryCircle;
  /** Recursion floor. Cells are never split below this side length. */
  readonly minCellSizeMeters: number;
  /** Hard cap on cells queried, so one sweep cannot spend without bound. */
  readonly requestBudget: number;
  /**
   * Ground already swept and still fresh. A cell whose query circle lies wholly
   * inside one of these is skipped without a discovery call.
   */
  readonly coveredCircles?: readonly QueryCircle[];
}

export interface CellToQuery {
  /** What to send to discovery: circumscribes the cell's square. */
  readonly circle: QueryCircle;
  readonly square: SquareMeters;
  readonly depth: number;
}

interface PendingCell {
  readonly square: SquareMeters;
  readonly depth: number;
}

/**
 * Depth-first adaptive subdivision over a request circle.
 *
 * The caller drives it: take a cell, query it, and report whether any discovery
 * pass came back at that endpoint's per-request maximum. Saturation is the only
 * evidence of truncation available, because the API reports no total count — so
 * a saturated cell is split and re-queried, and an unsaturated one is complete.
 *
 * Pure geometry and bookkeeping: no I/O, so the whole subdivision behaviour is
 * exercisable with synthetic verdicts.
 */
export class QuadtreeSweep {
  readonly #origin: Coordinates;
  readonly #requestRadiusMeters: number;
  readonly #minCellSizeMeters: number;
  readonly #requestBudget: number;
  readonly #coveredCircles: readonly QueryCircle[];

  readonly #pending: PendingCell[] = [];
  readonly #incomplete: CellToQuery[] = [];

  #queried = 0;
  #skipped = 0;
  #budgetExhausted = false;

  constructor(options: TilingOptions) {
    this.#origin = options.root.center;
    this.#requestRadiusMeters = options.root.radiusMeters;
    this.#minCellSizeMeters = options.minCellSizeMeters;
    this.#requestBudget = options.requestBudget;
    this.#coveredCircles = options.coveredCircles ?? [];

    this.#pending.push({
      square: {
        centerX: 0,
        centerY: 0,
        sideMeters: options.root.radiusMeters * 2,
      },
      depth: 0,
    });
  }

  /** The next cell to query, or null when the sweep is finished. */
  nextCell(): CellToQuery | null {
    while (this.#pending.length > 0) {
      if (this.#queried >= this.#requestBudget) {
        this.#budgetExhausted = true;
        this.#drainPendingAsIncomplete();
        return null;
      }

      const pending = this.#pending.shift()!;

      if (
        !squareIntersectsOriginCircle(pending.square, this.#requestRadiusMeters)
      ) {
        this.#skipped += 1;
        continue;
      }

      const cell = this.#toCell(pending);

      if (this.#isAlreadyCovered(cell.circle)) {
        this.#skipped += 1;
        continue;
      }

      this.#queried += 1;
      return cell;
    }

    return null;
  }

  /**
   * Feed back whether the cell's discovery saturated. A saturated cell is split
   * when it is still above the minimum size, and recorded as incomplete when it
   * is not — silence there would be the under-enumeration this design exists to
   * make visible.
   */
  reportSaturation(cell: CellToQuery, saturated: boolean): void {
    if (!saturated) return;

    const childSide = cell.square.sideMeters / 2;
    if (childSide < this.#minCellSizeMeters) {
      this.#incomplete.push(cell);
      return;
    }

    const children = childSquares(cell.square).map((square) => ({
      square,
      depth: cell.depth + 1,
    }));

    this.#pending.unshift(...children);
  }

  get incompleteCells(): readonly CellToQuery[] {
    return this.#incomplete;
  }

  get budgetExhausted(): boolean {
    return this.#budgetExhausted;
  }

  get cellsQueried(): number {
    return this.#queried;
  }

  get cellsSkipped(): number {
    return this.#skipped;
  }

  #toCell(pending: PendingCell): CellToQuery {
    return {
      square: pending.square,
      depth: pending.depth,
      circle: {
        center: offsetToCoordinates(this.#origin, {
          x: pending.square.centerX,
          y: pending.square.centerY,
        }),
        radiusMeters: circumscribedRadiusMeters(pending.square.sideMeters),
      },
    };
  }

  #isAlreadyCovered(circle: QueryCircle): boolean {
    return this.#coveredCircles.some((covered) =>
      circleFullyContains(covered, circle),
    );
  }

  #drainPendingAsIncomplete(): void {
    while (this.#pending.length > 0) {
      this.#incomplete.push(this.#toCell(this.#pending.shift()!));
    }
  }
}
