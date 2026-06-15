import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { generalRateLimit, authRateLimit } from "./middlewares/rateLimit.js";
import { idempotencyMiddleware } from "./middlewares/idempotency.js";
import { initFxRates } from "./services/fxRates.js";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(generalRateLimit);
app.use("/api/auth", authRateLimit);
app.use(idempotencyMiddleware);

app.use("/api", router);

initFxRates().catch((err) => logger.warn({ err }, "FX rates init failed — using fallback rates"));

export default app;
