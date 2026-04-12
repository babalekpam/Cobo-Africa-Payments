import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import merchantsRouter from "./merchants";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import walletsRouter from "./wallets";
import transfersRouter from "./transfers";
import exchangeRouter from "./exchange";
import beneficiariesRouter from "./beneficiariesRoute";
import notificationsRouter from "./notificationsRoute";
import paymentLinksRouter from "./paymentLinksRoute";
import kycRouter from "./kycRoute";
import exportsRouter from "./exports";
import checkoutApiRouter from "./checkoutApi";
import complianceRouter from "./compliance";

const router: IRouter = Router();

router.use(healthRouter);
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

export default router;
