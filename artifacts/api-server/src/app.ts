import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { allowedOrigins } from "./lib/security.js";
import { generalRateLimit, authRateLimit } from "./middlewares/rateLimit.js";
import { idempotencyMiddleware } from "./middlewares/idempotency.js";
import { initFxRates } from "./services/fxRates.js";

const app: Express = express();

// Behind nginx/Plesk on the VPS — trust exactly one proxy hop so rate limiting
// keys on the real client IP instead of the proxy's, without letting clients
// spoof X-Forwarded-For chains.
app.set("trust proxy", 1);

// Security headers. CSP is disabled because this API serves JSON plus a few
// self-contained HTML receipts with inline styles; HSTS is explicit since the
// platform is HTTPS-only in production.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

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

app.use(cors({ origin: allowedOrigins() }));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

app.use(generalRateLimit);
app.use("/api/auth", authRateLimit);
app.use(idempotencyMiddleware);

app.use("/api", router);

initFxRates().catch((err) => logger.warn({ err }, "FX rates init failed — using fallback rates"));

export default app;
