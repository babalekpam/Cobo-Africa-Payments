import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { iapayEnvironment } from "../lib/environment.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Public: lets every screen show whether this installation moves real money ("live") or test money
// ("sandbox"), so a demo can never be mistaken for the real thing.
router.get("/environment", (_req, res) => {
  res.json({ environment: iapayEnvironment(), scheme_name: process.env.SCHEME_NAME || "IAPAY" });
});

export default router;
