import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSocketIO } from "./services/socketio.js";
import { ensureSchemeParticipants } from "./services/scheme/participants.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening with WebSocket support");
  void ensureSchemeParticipants();
});
