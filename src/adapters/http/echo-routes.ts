import type { Express, Request, Response } from "express";
import { z } from "zod";
import { EchoValidationError, type EchoResult } from "../../domain/echo.js";

export type EchoUseCase = (input: { message: unknown }) => EchoResult;

const echoBodySchema = z.object({
  message: z.string().min(1),
});

export function registerEchoRoutes(
  app: Express,
  deps: { echo: EchoUseCase },
): void {
  app.post("/echo", (req: Request, res: Response) => {
    const parsed = echoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body: message must be a non-empty string" });
      return;
    }

    try {
      const result = deps.echo({ message: parsed.data.message });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof EchoValidationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
  });
}
