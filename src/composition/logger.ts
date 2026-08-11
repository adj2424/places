export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

const levelRank: Record<LogLevel, number> = {
  silent: 70,
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  debug: (message: string, extra?: Record<string, unknown>) => void;
};

function emit(
  minLevel: LogLevel,
  level: Exclude<LogLevel, "silent" | "fatal" | "trace">,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (levelRank[level] < levelRank[minLevel]) {
    return;
  }
  const line =
    extra === undefined ? `${level}: ${message}` : `${level}: ${message} ${JSON.stringify(extra)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(level: LogLevel): Logger {
  return {
    info: (message, extra) => emit(level, "info", message, extra),
    error: (message, extra) => emit(level, "error", message, extra),
    warn: (message, extra) => emit(level, "warn", message, extra),
    debug: (message, extra) => emit(level, "debug", message, extra),
  };
}
