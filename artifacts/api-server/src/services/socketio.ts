import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { logger } from "../lib/logger.js";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "WebSocket client connected");

    // Client joins a room named after their user ID to receive personal events
    socket.on("subscribe", (userId: number | string) => {
      socket.join(`user:${userId}`);
      logger.debug({ socketId: socket.id, userId }, "Client subscribed to user room");
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "WebSocket client disconnected");
    });
  });

  logger.info("Socket.IO WebSocket server initialised");
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
