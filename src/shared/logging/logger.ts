import pino, { type LevelWithSilent } from 'pino';

export type Logger = pino.Logger;
export type LogLevel = LevelWithSilent;

export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  });
}
