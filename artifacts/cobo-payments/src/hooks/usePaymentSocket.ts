import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = (import.meta.env.VITE_API_URL as string) || "";

export interface PaymentUpdate {
  reference: string;
  status: "completed" | "failed";
  amount: number;
  currency: string;
  provider: string;
  message: string;
}

export function usePaymentSocket(
  userId: number | null,
  onPaymentUpdate: (update: PaymentUpdate) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onPaymentUpdate);
  callbackRef.current = onPaymentUpdate;

  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe", userId);
    });

    socket.on("payment:update", (data: PaymentUpdate) => {
      callbackRef.current(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  const subscribe = useCallback((uid: number) => {
    socketRef.current?.emit("subscribe", uid);
  }, []);

  return { subscribe };
}
