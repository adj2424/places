import Fastify, { type FastifyInstance } from "fastify";
import type { SweepService } from "../../../application/sweep-service.js";
import { registerSweepRoute } from "./sweep-route.js";

export async function buildServer(options: {
  readonly sweep: SweepService;
  readonly radiusCeilingMeters: number;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  registerSweepRoute(app, options.sweep, options.radiusCeilingMeters);
  return app;
}
