import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../../composition/logger.js";

/** Request logging middleware. Does not log bodies (secrets / PII risk). */
export function requestLogging(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info("request", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    next();
  };
}
