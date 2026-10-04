import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
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
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
