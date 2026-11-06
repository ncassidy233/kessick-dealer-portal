import pino, { type LoggerOptions } from "pino";
import { safeErrorForLog } from "./safeLogging";

const isProduction = process.env.NODE_ENV === "production";

export const protectedLoggerOptions: LoggerOptions = {
  serializers: { err: safeErrorForLog, error: safeErrorForLog },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-api-key']",
    "req.headers['clerk-secret-key']",
    "res.headers['set-cookie']",
    "*.password",
    "*.secret",
    "*.token",
    "*.client_secret",
    "*.code",
    "password",
    "secret",
    "token",
    "client_secret",
    "authorization",
    "cookie",
    "apiKey",
    "access_token",
    "refresh_token",
    "*.apiKey",
    "*.access_token",
    "*.refresh_token",
    "*.connectionString",
    "*.DATABASE_URL",
  ],
};

export const logger = pino({
  ...protectedLoggerOptions,
  level: process.env.LOG_LEVEL ?? "info",
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
