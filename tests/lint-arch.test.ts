import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script, intentionally untyped
import { checkArchitecture } from "../scripts/lint-arch.mjs";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "arch-check-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeSource(relativePath: string, contents: string) {
  const full = join(root, relativePath);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, contents, "utf8");
}

describe("checkArchitecture", () => {
  it("reports a violation when domain code imports an adapter", async () => {
    await writeSource(
      "domain/scoring/score.ts",
      `import { supabase } from "../../adapters/outbound/supabase/client.js";\nexport const score = () => supabase;\n`,
    );
    await writeSource(
      "adapters/outbound/supabase/client.ts",
      `export const supabase = {};\n`,
    );

    const violations = await checkArchitecture(root);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("domain-must-not-import-adapters");
    expect(violations[0].file).toContain("score.ts");
  });

  it("reports a violation when an inbound adapter imports an outbound adapter", async () => {
    await writeSource(
      "adapters/inbound/http/sweep-route.ts",
      `import { discover } from "../../outbound/google/places-discovery.js";\nexport const route = () => discover;\n`,
    );
    await writeSource(
      "adapters/outbound/google/places-discovery.ts",
      `export const discover = () => [];\n`,
    );

    const violations = await checkArchitecture(root);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("inbound-must-not-import-outbound");
  });

  it("accepts a domain module that imports only other domain modules", async () => {
    await writeSource(
      "domain/model/segment.ts",
      `export type Segment = "no_website";\n`,
    );
    await writeSource(
      "domain/qualification/segment.ts",
      `import type { Segment } from "../model/segment.js";\nexport const pick = (): Segment => "no_website";\n`,
    );

    await expect(checkArchitecture(root)).resolves.toHaveLength(0);
  });

  it("accepts an inbound adapter that imports an application port", async () => {
    await writeSource(
      "application/ports/geocoder.ts",
      `export interface Geocoder { resolve(q: string): Promise<void> }\n`,
    );
    await writeSource(
      "adapters/inbound/http/sweep-route.ts",
      `import type { Geocoder } from "../../../application/ports/geocoder.js";\nexport type Deps = { geocoder: Geocoder };\n`,
    );

    await expect(checkArchitecture(root)).resolves.toHaveLength(0);
  });

  it("ignores bare package imports in domain code", async () => {
    await writeSource(
      "domain/scoring/score.ts",
      `import { z } from "zod";\nexport const schema = z.object({});\n`,
    );

    await expect(checkArchitecture(root)).resolves.toHaveLength(0);
  });

  it("catches a dynamic import that crosses the boundary", async () => {
    await writeSource(
      "domain/tiling/quadtree.ts",
      `export async function load() { return import("../../adapters/outbound/google/places-discovery.js"); }\n`,
    );

    const violations = await checkArchitecture(root);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("domain-must-not-import-adapters");
  });
});
