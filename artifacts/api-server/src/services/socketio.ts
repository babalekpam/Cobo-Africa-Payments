import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { logger } from "../lib/logger.js";
import { resolveSession } from "../middlewares/requireAuth.js";
import { allowedOrigins } from "../lib/security.js";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins(), methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  // Authenticate every socket at the handshake: the client sends its JWT via
  // `auth: { token }` (or an Authorization header). The user id comes from the
  // VERIFIED token only — clients can never subscribe to someone else's room.
  io.use(async (socket, next) => {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
    // Same rule as the HTTP API (resolveSession): a valid signature is not enough — the account must
    // be active RIGHT NOW and the token must not predate its last password change.
    try {
      const session = raw ? await resolveSession(raw) : null;
      if (!session) {
        next(new Error("Authentication required"));
        return;
      }
      socket.data.userId = session.id;
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as number;
    socket.join(`user:${userId}`);
    logger.debug({ socketId: socket.id, userId }, "WebSocket client connected and joined own room");

    // Legacy clients still emit "subscribe" — accept it but ignore the payload;
    // the room membership is always the authenticated user's own.
    socket.on("subscribe", () => {
      socket.join(`user:${userId}`);
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "WebSocket client disconnected");
    });
  });

  logger.info("Socket.IO WebSocket server initialised (JWT-authenticated)");
  return io;
}

// Emit payment status update to all sockets subscribed to a user's room
export function emitPaymentUpdate(
  userId: number,
  data: {
    reference: string;
    status: "completed" | "failed";
    amount: number;
    currency: string;
    provider: string;
    message: string;
  },
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("payment:update", data);
  logger.debug({ userId, reference: data.reference, status: data.status, provider: data.provider }, "Emitted payment:update via WebSocket");
}

export function getIO(): SocketIOServer | null {
  return io;
}
