import { describe, expect, it } from "vitest";
import {
  childSquares,
  circumscribedRadiusMeters,
  offsetToCoordinates,
  squareCorners,
} from "../../src/domain/tiling/geometry.js";
import { QuadtreeSweep } from "../../src/domain/tiling/quadtree.js";
import type { QueryCircle } from "../../src/domain/model/geo.js";

const ANNANDALE = { latitude: 38.8304, longitude: -77.1964 };

function sweep(overrides: Partial<ConstructorParameters<typeof QuadtreeSweep>[0]> = {}) {
  return new QuadtreeSweep({
    root: { center: ANNANDALE, radiusMeters: 2000 },
    minCellSizeMeters: 250,
    requestBudget: 2000,
    coveredCircles: [],
    ...overrides,
  });
}

/** Drains the sweep, answering every cell with the same saturation verdict. */
function drain(
  run: QuadtreeSweep,
  saturated: (depth: number) => boolean,
  maxCells = 20_000,
) {
  const queried = [];
  for (let guard = 0; guard < maxCells; guard += 1) {
    const cell = run.nextCell();
    if (cell === null) return queried;
    queried.push(cell);
    run.reportSaturation(cell, saturated(cell.depth));
  }
  throw new Error("sweep did not terminate");
}

describe("geometry", () => {
  it("gives a cell a query circle that fully contains its square", () => {
    const side = 800;
    const radius = circumscribedRadiusMeters(side);
    const corners = squareCorners({ centerX: 0, centerY: 0, sideMeters: side });

    for (const corner of corners) {
      const distance = Math.hypot(corner.x, corner.y);
      expect(distance).toBeLessThanOrEqual(radius + 1e-9);
    }
    // Tight, not merely sufficient: the circle touches the corners.
    expect(radius).toBeCloseTo(Math.hypot(side / 2, side / 2), 9);
  });

  it("splits a square into four children that tile it without gaps or overlap", () => {
    const parent = { centerX: 100, centerY: -50, sideMeters: 400 };
    const children = childSquares(parent);

    expect(children).toHaveLength(4);
    for (const child of children) {
      expect(child.sideMeters).toBeCloseTo(200, 9);
    }

    const childArea = children.length * children[0]!.sideMeters ** 2;
    expect(childArea).toBeCloseTo(parent.sideMeters ** 2, 6);

    const centers = new Set(children.map((c) => `${c.centerX},${c.centerY}`));
    expect(centers.size).toBe(4);

    for (const child of children) {
      expect(Math.abs(child.centerX - parent.centerX)).toBeCloseTo(100, 9);
      expect(Math.abs(child.centerY - parent.centerY)).toBeCloseTo(100, 9);
    }
  });

  it("covers the whole parent square with the union of its child query circles", () => {
    const parent = { centerX: 0, centerY: 0, sideMeters: 1000 };
    const children = childSquares(parent);
    const half = parent.sideMeters / 2;

    for (let x = -half; x <= half; x += 25) {
      for (let y = -half; y <= half; y += 25) {
        const covered = children.some((child) => {
          const r = circumscribedRadiusMeters(child.sideMeters);
          return Math.hypot(x - child.centerX, y - child.centerY) <= r + 1e-9;
        });
        expect(covered, `point (${x}, ${y}) uncovered`).toBe(true);
      }
    }
  });

  it("converts a metre offset back to coordinates that measure the same distance", () => {
    const moved = offsetToCoordinates(ANNANDALE, { x: 1000, y: 0 });
    expect(moved.latitude).toBeCloseTo(ANNANDALE.latitude, 6);
    expect(moved.longitude).toBeGreaterThan(ANNANDALE.longitude);

    const north = offsetToCoordinates(ANNANDALE, { x: 0, y: 1000 });
    expect(north.latitude).toBeGreaterThan(ANNANDALE.latitude);
    expect(north.longitude).toBeCloseTo(ANNANDALE.longitude, 6);
  });
});

describe("QuadtreeSweep", () => {
  it("yields a single cell when the radius is under the minimum cell size", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 100 },
      minCellSizeMeters: 250,
    });

    const queried = drain(run, () => true);

    expect(queried).toHaveLength(1);
    expect(run.incompleteCells).toHaveLength(1);
  });

  it("produces four children for a saturated cell", () => {
    const run = sweep({ root: { center: ANNANDALE, radiusMeters: 1000 } });

    const first = run.nextCell();
    expect(first).not.toBeNull();
    run.reportSaturation(first!, true);

    const children = [];
    for (let i = 0; i < 4; i += 1) {
      const child = run.nextCell();
      expect(child).not.toBeNull();
      children.push(child!);
      run.reportSaturation(child!, false);
    }

    expect(run.nextCell()).toBeNull();
    for (const child of children) {
      expect(child.depth).toBe(1);
      expect(child.square.sideMeters).toBeCloseTo(
        first!.square.sideMeters / 2,
        6,
      );
    }
  });

  it("produces no children for an unsaturated cell", () => {
    const run = sweep({ root: { center: ANNANDALE, radiusMeters: 1000 } });

    const first = run.nextCell();
    run.reportSaturation(first!, false);

    expect(run.nextCell()).toBeNull();
    expect(run.incompleteCells).toHaveLength(0);
  });

  it("stops subdividing at the minimum cell size even while still saturated", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 1000 },
      minCellSizeMeters: 500,
    });

    const queried = drain(run, () => true);

    for (const cell of queried) {
      expect(cell.square.sideMeters).toBeGreaterThanOrEqual(500 - 1e-6);
    }
    expect(queried.length).toBeGreaterThan(1);
  });

  it("reports a cell still saturated at minimum size as incomplete", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 500 },
      minCellSizeMeters: 500,
    });

    drain(run, () => true);

    expect(run.incompleteCells.length).toBeGreaterThan(0);
    expect(run.budgetExhausted).toBe(false);
  });

  it("stops when the request budget is exhausted and flags incompleteness", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 4000 },
      minCellSizeMeters: 250,
      requestBudget: 5,
    });

    const queried = drain(run, () => true);

    expect(queried).toHaveLength(5);
    expect(run.budgetExhausted).toBe(true);
    expect(run.cellsQueried).toBe(5);
  });

  it("skips a cell whose query circle lies entirely inside covered ground", () => {
    const root: QueryCircle = {
      center: ANNANDALE,
      radiusMeters: 1000,
    };
    const rootCircleRadius = circumscribedRadiusMeters(2000);

    const run = sweep({
      root,
      coveredCircles: [
        { center: ANNANDALE, radiusMeters: rootCircleRadius + 10 },
      ],
    });

    expect(run.nextCell()).toBeNull();
    expect(run.cellsQueried).toBe(0);
    expect(run.cellsSkipped).toBeGreaterThan(0);
  });

  it("still queries a cell that only partially overlaps covered ground", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 1000 },
      coveredCircles: [{ center: ANNANDALE, radiusMeters: 50 }],
    });

    const first = run.nextCell();

    expect(first).not.toBeNull();
    run.reportSaturation(first!, false);
    expect(run.cellsQueried).toBe(1);
  });

  it("never yields the same cell twice while fully enumerating a saturated tree", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 2000 },
      minCellSizeMeters: 1000,
    });

    const queried = drain(run, () => true);
    const keys = queried.map(
      (c) => `${c.square.centerX}:${c.square.centerY}:${c.square.sideMeters}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("subdivides only the saturated branch, leaving satisfied siblings alone", () => {
    const run = sweep({
      root: { center: ANNANDALE, radiusMeters: 2000 },
      minCellSizeMeters: 500,
    });

    const root = run.nextCell()!;
    run.reportSaturation(root, true);

    const firstChild = run.nextCell()!;
    run.reportSaturation(firstChild, true);

    const grandchildren = [];
    for (let i = 0; i < 4; i += 1) {
      const cell = run.nextCell()!;
      grandchildren.push(cell);
      run.reportSaturation(cell, false);
    }

    expect(grandchildren.every((c) => c.depth === 2)).toBe(true);

    const remaining = drain(run, () => false);
    expect(remaining.every((c) => c.depth === 1)).toBe(true);
    expect(remaining).toHaveLength(3);
  });
});
