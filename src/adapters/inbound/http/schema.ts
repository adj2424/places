export interface SweepBody {
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly radiusMeters: number;
}

export type SweepParseResult =
  | { readonly ok: true; readonly value: SweepBody }
  | { readonly ok: false; readonly message: string };

export function parseSweepBody(input: unknown): SweepParseResult {
  if (input === null || typeof input !== "object") {
    return { ok: false, message: "Body must be a JSON object" };
  }

  const body = input as Record<string, unknown>;
  const radiusMeters = body.radiusMeters;
  if (typeof radiusMeters !== "number" || !Number.isFinite(radiusMeters)) {
    return { ok: false, message: "radiusMeters must be a number" };
  }
  if (radiusMeters <= 0) {
    return { ok: false, message: "radiusMeters must be positive" };
  }

  const address =
    typeof body.address === "string" && body.address.trim() !== ""
      ? body.address.trim()
      : undefined;
  const latitude =
    typeof body.latitude === "number" ? body.latitude : undefined;
  const longitude =
    typeof body.longitude === "number" ? body.longitude : undefined;

  const hasAddress = address !== undefined;
  const hasCoords = latitude !== undefined || longitude !== undefined;

  if (hasAddress && hasCoords) {
    return {
      ok: false,
      message: "Provide either address or coordinates, not both",
    };
  }
  if (!hasAddress && !hasCoords) {
    return {
      ok: false,
      message: "Provide either address or latitude/longitude",
    };
  }
  if (!hasAddress) {
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return {
        ok: false,
        message: "Both latitude and longitude are required",
      };
    }
  }

  return {
    ok: true,
    value: {
      address,
      latitude,
      longitude,
      radiusMeters,
    },
  };
}
