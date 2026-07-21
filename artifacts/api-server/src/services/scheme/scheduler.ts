// Afrix settlement scheduler — real schemes settle on a clock, not on demand.
// Closes the open batch and runs multilateral netting every SETTLEMENT_INTERVAL_HOURS
// (default 4h, like a card scheme's intraday cycles). The manual admin endpoint
// remains available for out-of-cycle settlement.

import { closeSettlementCycle } from "./settlement.js";
import { logger } from "../../lib/logger.js";

let timer: NodeJS.Timeout | null = null;

export function startSettlementScheduler(): void {
  const hours = Number(process.env.SETTLEMENT_INTERVAL_HOURS || 4);
  if (!hours || hours <= 0) {
    logger.info("Afrix settlement scheduler disabled (SETTLEMENT_INTERVAL_HOURS <= 0)");
    return;
  }
  const intervalMs = hours * 60 * 60 * 1000;

  timer = setInterval(async () => {
    try {
      const summary = await closeSettlementCycle();
      if (summary) {
        logger.info(
          { batch: summary.batch.batchRef, transfers: summary.transferCount, positions: summary.positions.length },
          "Afrix settlement cycle closed"
        );
      }
    } catch (err) {
      logger.error({ err }, "Afrix settlement cycle failed — batch will be retried next interval");
    }
  }, intervalMs);
  timer.unref(); // never keep the process alive just for settlement

  logger.info({ hours }, "Afrix settlement scheduler started");
}

export function stopSettlementScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
