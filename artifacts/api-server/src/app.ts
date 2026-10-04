import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { csrfGuard } from "./security/csrf";
import { securityHeaders } from "./security/headers";
import { configuredOrigins } from "./security/origin";
import {
  aiRateLimit,
  apiRateLimit,
  oauthRateLimit,
  uploadRateLimit,
} from "./security/rateLimits";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use((req, res, next) => {
  req.setTimeout(35_000);
  res.setTimeout(35_000, () => {
    if (!res.headersSent) res.status(504).json({ error: "The request timed out." });
    else res.end();
  });
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = configuredOrigins();

app.use(
  cors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Kessick-CSRF"],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      const error = Object.assign(new Error("Origin is not allowed"), {
        status: 403,
        code: "CORS_ORIGIN_REJECTED",
      });
      callback(error);
    },
  }),
);
app.use("/api", apiRateLimit);
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use("/api", uploadRateLimit, aiRateLimit, oauthRateLimit);
app.use("/api", csrfGuard(allowedOrigins));

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : 500;
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "UNHANDLED";
    if (status >= 500) req.log.error({ err: error, code }, "Unhandled API error");
    else req.log.warn({ code, status, method: req.method, path: req.path }, "Request rejected");
    if (!res.headersSent) {
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: status === 403 ? "Request origin is not allowed." : "The request could not be completed.",
      });
    }
  },
);

export default app;
