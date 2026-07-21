import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import merchantsRouter from "./merchants.js";
import transactionsRouter from "./transactions.js";
import dashboardRouter from "./dashboard.js";
import walletsRouter from "./wallets.js";
import transfersRouter from "./transfers.js";
import exchangeRouter from "./exchange.js";
import beneficiariesRouter from "./beneficiariesRoute.js";
import notificationsRouter from "./notificationsRoute.js";
import paymentLinksRouter from "./paymentLinksRoute.js";
import kycRouter from "./kycRoute.js";
import exportsRouter from "./exports.js";
import checkoutApiRouter from "./checkoutApi.js";
import complianceRouter from "./compliance.js";
import depositsRouter from "./deposits.js";
import storageRouter from "./storage.js";
import webhookRouter from "./webhooks.js";
import ussdRouter from "./ussd.js";
import qrRouter from "./qr.js";
import schemeRouter from "./scheme.js";

const router: IRouter = Router();

// Public endpoints — no auth required
router.use(webhookRouter);
router.use(ussdRouter);

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(merchantsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(walletsRouter);
router.use(transfersRouter);
router.use(exchangeRouter);
router.use(beneficiariesRouter);
router.use(notificationsRouter);
router.use(paymentLinksRouter);
router.use(kycRouter);
router.use(exportsRouter);
router.use(checkoutApiRouter);
router.use(complianceRouter);
router.use(depositsRouter);
router.use(qrRouter);
router.use(schemeRouter);

export default router;
