import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

describe("supabase migrations", () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) =>
    name.endsWith(".sql"),
  );

  it("includes the required migration files in order", () => {
    expect(files).toEqual([
      "0001_enable_postgis.sql",
      "0002_leads.sql",
      "0003_swept_cells.sql",
      "0004_lead_rpcs.sql",
      "0005_coverage_rpcs.sql",
    ]);
  });

  it("enables postgis and uses EPSG:32618 for lead locations", () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, "0001_enable_postgis.sql"), "utf8");
    expect(sql).toMatch(/create extension if not exists postgis/i);

    const leads = readFileSync(join(MIGRATIONS_DIR, "0002_leads.sql"), "utf8");
    expect(leads).toMatch(/geometry\(Point,\s*32618\)/);
    expect(leads).toMatch(/create table public\.leads/);
    expect(leads).toMatch(/place_id text primary key/);
    expect(leads).toMatch(/contact_snapshot_score/);
    expect(leads).toMatch(/qualified_leads/);
    expect(leads).toMatch(/segment is not null/);
  });

  it("preserves operator columns on upsert conflict", () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, "0004_lead_rpcs.sql"), "utf8");
    expect(sql).toMatch(/on conflict \(place_id\) do update set/);
    expect(sql).not.toMatch(/contact_status\s*=\s*excluded/);
    expect(sql).not.toMatch(/notes\s*=\s*excluded/);
    expect(sql).not.toMatch(/contact_snapshot_score\s*=\s*excluded/);
  });

  it("stores incomplete flag and coverage containment helper", () => {
    const cells = readFileSync(
      join(MIGRATIONS_DIR, "0003_swept_cells.sql"),
      "utf8",
    );
    expect(cells).toMatch(/incomplete boolean/);
    expect(cells).toMatch(/is_circle_fully_covered/);
  });
});
