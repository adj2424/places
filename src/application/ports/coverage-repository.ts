import type { QueryCircle } from "../../domain/model/geo.js";

export interface SweptCell {
  readonly circle: QueryCircle;
  readonly sweptAt: Date;
  /** True when the cell stayed saturated at minimum size or a budget ran out. */
  readonly incomplete: boolean;
}

export interface CoverageRepository {
  recordSweptCells(cells: readonly SweptCell[]): Promise<void>;

  /**
   * True when the circle lies entirely inside coverage newer than `freshSince`.
   * A containment answer rather than a subtracted remainder: the remainder of
   * subtracting covered polygons is an arbitrary multi-part shape that neither
   * the quadtree nor the circle-only discovery API can query.
   */
  isFullyCovered(circle: QueryCircle, freshSince: Date): Promise<boolean>;

  /**
   * Fresh swept query circles for the tiling engine's exclusion list. Loaded
   * once per sweep so already-covered cells are skipped without burning budget.
   */
  listFreshCircles(freshSince: Date): Promise<readonly QueryCircle[]>;
}
