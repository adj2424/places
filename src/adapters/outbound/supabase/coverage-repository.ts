import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoverageRepository,
  SweptCell,
} from "../../../application/ports/coverage-repository.js";
import type { QueryCircle } from "../../../domain/model/geo.js";
import { RepositoryError } from "./client.js";

type Supabase = SupabaseClient;

export class SupabaseCoverageRepository implements CoverageRepository {
  readonly #client: Supabase;

  constructor(client: Supabase) {
    this.#client = client;
  }

  async recordSweptCells(cells: readonly SweptCell[]): Promise<void> {
    if (cells.length === 0) return;

    const rows = cells.map((cell) => ({
      center_lon: cell.circle.center.longitude,
      center_lat: cell.circle.center.latitude,
      radius_meters: cell.circle.radiusMeters,
      swept_at: cell.sweptAt.toISOString(),
      incomplete: cell.incomplete,
    }));

    const { error } = await this.#client.rpc("record_swept_cells", {
      rows,
    });

    if (error) {
      throw new RepositoryError(`Coverage write failed: ${error.message}`, {
        cause: error,
      });
    }
  }

  async isFullyCovered(
    circle: QueryCircle,
    freshSince: Date,
  ): Promise<boolean> {
    const { data, error } = await this.#client.rpc("is_circle_fully_covered", {
      lon: circle.center.longitude,
      lat: circle.center.latitude,
      radius_meters: circle.radiusMeters,
      fresh_since: freshSince.toISOString(),
    });

    if (error) {
      throw new RepositoryError(`Coverage read failed: ${error.message}`, {
        cause: error,
      });
    }

    return Boolean(data);
  }

  async listFreshCircles(freshSince: Date): Promise<readonly QueryCircle[]> {
    const { data, error } = await this.#client.rpc("list_fresh_swept_circles", {
      fresh_since: freshSince.toISOString(),
    });

    if (error) {
      throw new RepositoryError(
        `Fresh coverage list failed: ${error.message}`,
        { cause: error },
      );
    }

    return (
      (data as {
        lon: number;
        lat: number;
        radius_meters: number;
      }[]) ?? []
    ).map((row) => ({
      center: { latitude: row.lat, longitude: row.lon },
      radiusMeters: row.radius_meters,
    }));
  }
}
