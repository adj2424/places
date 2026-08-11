import type { FastifyInstance } from "fastify";
import { QuotaExhaustedError } from "../../../application/errors.js";
import {
  SweepAmbiguityError,
  SweepUnresolvableError,
  SweepValidationError,
  type SweepService,
} from "../../../application/sweep-service.js";
import { parseSweepBody } from "./schema.js";

export function registerSweepRoute(
  app: FastifyInstance,
  sweep: SweepService,
  radiusCeilingMeters: number,
): void {
  app.post("/sweep", async (request, reply) => {
    const parsed = parseSweepBody(request.body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: "invalid_input", message: parsed.message });
    }

    if (parsed.value.radiusMeters > radiusCeilingMeters) {
      return reply.code(400).send({
        error: "radius_ceiling",
        message: `radiusMeters exceeds ceiling of ${radiusCeilingMeters}`,
        ceilingMeters: radiusCeilingMeters,
      });
    }

    const origin =
      parsed.value.address !== undefined
        ? { kind: "address" as const, address: parsed.value.address }
        : {
            kind: "coordinates" as const,
            coordinates: {
              latitude: parsed.value.latitude!,
              longitude: parsed.value.longitude!,
            },
          };

    try {
      const result = await sweep.run({
        origin,
        radiusMeters: parsed.value.radiusMeters,
      });

      return reply.code(200).send({
        placeIds: result.placeIds,
        incomplete: result.incomplete,
      });
    } catch (error) {
      if (error instanceof SweepValidationError) {
        return reply
          .code(400)
          .send({ error: "invalid_input", message: error.message });
      }
      if (error instanceof SweepAmbiguityError) {
        return reply.code(409).send({
          error: "ambiguous_address",
          message: error.message,
          candidates: error.candidates,
        });
      }
      if (error instanceof SweepUnresolvableError) {
        return reply
          .code(404)
          .send({ error: "unresolvable_address", message: error.message });
      }
      if (error instanceof QuotaExhaustedError) {
        return reply
          .code(429)
          .send({ error: "quota_exhausted", message: error.message });
      }
      request.log.error(error);
      return reply
        .code(502)
        .send({ error: "upstream_failure", message: "Upstream dependency failed" });
    }
  });
}
