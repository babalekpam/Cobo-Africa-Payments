import { Router } from "express";
import { db, usersTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkDailyLimit } from "../lib/limits.js";
import { generateRef } from "../lib/refgen.js";
import { processInstantPayment } from "../services/scheme/switchEngine.js";
import { resolveAlias, listUserAliases } from "../services/scheme/directory.js";
import { isProduction, safeEqual, isLockedOut, recordFailedAttempt, clearAttempts } from "../lib/security.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/ussd", async (req, res): Promise<void> => {
  // Only the USSD gateway may call this endpoint. Configure the gateway's
  // callback URL as /api/ussd?secret=<USSD_GATEWAY_SECRET>. Fail closed in
  // production; open in dev for the simulator.
  const gatewaySecret = process.env.USSD_GATEWAY_SECRET;
  if (gatewaySecret) {
    const provided = String(req.query.secret || req.headers["x-ussd-secret"] || "");
    if (!provided || !safeEqual(provided, gatewaySecret)) {
      res.status(401).send("END Unauthorized");
      return;
    }
  } else if (isProduction()) {
    logger.error("USSD_GATEWAY_SECRET not configured — rejecting USSD request (fail closed)");
    res.status(401).send("END Service unavailable");
    return;
  }

  const { phoneNumber, text } = req.body as { sessionId?: string; phoneNumber?: string; text?: string };
  const inputs = (text || "").split("*").filter(Boolean);
  const level = inputs.length;

  let response = "";

  if (level === 0) {
    response = `CON Welcome to IAPAY
1. Check Balance
2. Send Money
3. Mini Statement
4. My Account
5. IAPAY Instant Pay
0. Exit`;
  } else if (inputs[0] === "0") {
    response = "END Thank you for using IAPAY. Goodbye!";
  } else if (inputs[0] === "1") {
    const user = await findUserByPhone(phoneNumber || "");
    if (!user) {
      response = "END Account not found. Download the IAPAY app to register.";
    } else {
      const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
      if (wallets.length === 0) {
        response = "END No wallets found.";
      } else {
        const balanceLines = wallets.map((w: { currency: string; balance: string | number | null }) => `${w.currency}: ${Number(w.balance).toLocaleString()}`).join("\n");
        response = `END Your IAPAY Balances:\n${balanceLines}`;
      }
    }
  } else if (inputs[0] === "2") {
    if (level === 1) {
      response = "CON Enter recipient phone number:";
    } else if (level === 2) {
      response = "CON Enter amount:";
    } else if (level === 3) {
      response = "CON Enter your IAPAY PIN:";
    } else if (level === 4) {
      const recipientPhone = inputs[1];
      const amount = parseFloat(inputs[2]);
      const pin = inputs[3];

      const user = await findUserByPhone(phoneNumber || "");
      if (!user) {
        response = "END Account not found.";
      } else if (isNaN(amount) || amount <= 0) {
        response = "END Invalid amount.";
      } else {
        const pinKey = `ussd-pin:${phoneNumber}`;
        const validPin = !isLockedOut(pinKey) && user.passwordHash ? await bcrypt.compare(pin, user.passwordHash) : false;
        if (validPin) clearAttempts(pinKey);
        if (isLockedOut(pinKey)) {
          response = "END Too many wrong PINs. Try again in 15 minutes.";
        } else if (!validPin) {
          recordFailedAttempt(pinKey);
          response = "END Invalid PIN. Transaction cancelled.";
        } else {
          const [wallet] = await db.select().from(walletsTable).where(
            and(eq(walletsTable.userId, user.id), eq(walletsTable.isDefault, true))
          );
          if (!wallet) {
            response = "END No default wallet found.";
          } else if (Number(wallet.balance) < amount) {
            response = `END Insufficient balance. You have ${wallet.currency} ${Number(wallet.balance).toLocaleString()}`;
          } else {
            const recipient = await findUserByPhone(recipientPhone);
            if (!recipient) {
              response = `END Recipient not found on IAPAY. They must register first.`;
            } else {
              // Same guardrails as every other rail: KYC daily limit, then an
              // atomic row-locked debit/credit so USSD can't double-spend.
              const kycLevel = Number(user.kycLevel || 0);
              const limitCheck = await checkDailyLimit(user.id, kycLevel, amount);
              if (!limitCheck.allowed) {
                response = `END Daily limit reached. ${limitCheck.message || ""}`;
              } else {
                const ref = generateRef("USSD");
                try {
                  await db.transaction(async (tx) => {
                    const [locked] = await tx.select().from(walletsTable).where(eq(walletsTable.id, wallet.id)).for("update");
                    if (!locked || Number(locked.balance) < amount) throw new Error("INSUFFICIENT_FUNDS");
                    await tx.update(walletsTable).set({ balance: sql`${walletsTable.balance} - ${String(amount)}` }).where(eq(walletsTable.id, wallet.id));

                    let [recWallet] = await tx.select().from(walletsTable).where(
                      and(eq(walletsTable.userId, recipient.id), eq(walletsTable.currency, wallet.currency))
                    ).for("update");
                    if (!recWallet) {
                      [recWallet] = await tx.insert(walletsTable).values({ userId: recipient.id, currency: wallet.currency, balance: "0" }).returning();
                    }
                    await tx.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${String(amount)}` }).where(eq(walletsTable.id, recWallet.id));

                    await tx.insert(transactionsTable).values({
                      reference: ref,
                      amount: String(amount),
                      currency: wallet.currency,
                      status: "completed",
                      type: "send",
                      customerId: user.id,
                      description: `USSD transfer to ${recipientPhone}`,
                      paymentMethod: "ussd",
                    });
                  });
                  response = `END Transfer Successful!\nSent: ${wallet.currency} ${amount.toLocaleString()}\nTo: ${recipientPhone}\nRef: ${ref}`;
                } catch (err) {
                  response = err instanceof Error && err.message === "INSUFFICIENT_FUNDS"
                    ? "END Insufficient balance."
                    : "END Transfer failed. Please try again.";
                }
              }
            }
          }
        }
      }
    } else {
      response = "END Session expired. Please try again.";
    }
  } else if (inputs[0] === "3") {
    const user = await findUserByPhone(phoneNumber || "");
    if (!user) {
      response = "END Account not found.";
    } else {
      const txs = await db.select().from(transactionsTable)
        .where(eq(transactionsTable.customerId, user.id))
        .orderBy(desc(transactionsTable.createdAt))
        .limit(3);
      if (txs.length === 0) {
        response = "END No transactions found.";
      } else {
        const lines = txs.map((t: { type: string | null; currency: string; amount: string | number | null }) => `${t.type}: ${t.currency} ${Number(t.amount).toLocaleString()}`).join("\n");
        response = `END Last ${txs.length} transactions:\n${lines}`;
      }
    }
  } else if (inputs[0] === "4") {
    const user = await findUserByPhone(phoneNumber || "");
    if (!user) {
      response = "END Account not found.";
    } else {
      response = `END IAPAY Account\nName: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nKYC Level: ${user.kycLevel || 0}`;
    }
  } else if (inputs[0] === "5") {
    // IAPAY — instant pay by key, on any feature phone. Goes through the same
    // switch engine as the app, so KYC limits, sanctions screening and atomic
    // clearing all apply.
    if (level === 1) {
      response = `CON IAPAY Instant Pay
1. Pay an IAPAY key
2. My IAPAY keys`;
    } else if (inputs[1] === "2") {
      const user = await findUserByPhone(phoneNumber || "");
      if (!user) {
        response = "END Account not found. Download the IAPAY app to register.";
      } else {
        const keys = await listUserAliases(user.id);
        if (keys.length === 0) {
          response = "END No IAPAY keys yet. Register one in the IAPAY app.";
        } else {
          const lines = keys
            .map((k) => `${k.aliasValue}${k.status === "active" ? "" : " (pending)"}`)
            .join("\n");
          response = `END Your IAPAY keys:\n${lines}`;
        }
      }
    } else if (inputs[1] === "1") {
      if (level === 2) {
        response = "CON Enter recipient's IAPAY key (phone, email or ID):";
      } else if (level === 3) {
        const resolved = await resolveAlias(inputs[2]);
        if (!resolved) {
          response = "END IAPAY key not found in the network directory.";
        } else {
          response = `CON Paying ${resolved.holderName} (${resolved.participant.name})
Enter amount:`;
        }
      } else if (level === 4) {
        response = "CON Enter your IAPAY PIN:";
      } else if (level === 5) {
        const key = inputs[2];
        const amount = parseFloat(inputs[3]);
        const pin = inputs[4];
        const user = await findUserByPhone(phoneNumber || "");
        if (!user) {
          response = "END Account not found.";
        } else if (isNaN(amount) || amount <= 0) {
          response = "END Invalid amount.";
        } else {
          const pinKey = `ussd-pin:${phoneNumber}`;
          const validPin = !isLockedOut(pinKey) && user.passwordHash ? await bcrypt.compare(pin, user.passwordHash) : false;
          if (validPin) clearAttempts(pinKey);
          if (isLockedOut(pinKey)) {
            response = "END Too many wrong PINs. Try again in 15 minutes.";
          } else if (!validPin) {
            recordFailedAttempt(pinKey);
            response = "END Invalid PIN. Transaction cancelled.";
          } else {
            const [defaultWallet] = await db.select().from(walletsTable).where(
              and(eq(walletsTable.userId, user.id), eq(walletsTable.isDefault, true))
            );
            const result = await processInstantPayment({
              senderUserId: user.id,
              senderEmail: user.email,
              alias: key,
              amount,
              walletId: defaultWallet?.id,
              description: "IAPAY payment via USSD",
            });
            if (!result.ok) {
              response = `END Payment failed: ${result.message}`;
            } else {
              response = `END IAPAY payment sent!
${result.recipientCurrency} ${result.recipientAmount!.toLocaleString(undefined, { maximumFractionDigits: 2 })} to ${result.recipientName}
Ref: ${result.transfer!.reference}
Free - Instant - 24/7`;
            }
          }
        }
      } else {
        response = "END Session expired. Please try again.";
      }
    } else {
      response = "END Invalid option. Please try again.";
    }
  } else {
    response = "END Invalid option. Please try again.";
  }

  res.set("Content-Type", "text/plain");
  res.send(response);
});

async function findUserByPhone(phone: string) {
  const normalized = phone.replace(/[\s+]/g, "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalized));
  if (user) return user;
  const [user2] = await db.select().from(usersTable).where(eq(usersTable.phone, "+" + normalized));
  return user2 || null;
}

export default router;
