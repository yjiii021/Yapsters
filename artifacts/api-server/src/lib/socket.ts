import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken } from "./auth";
import { logger } from "./logger";

let io: SocketServer | null = null;

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/ws/socket.io",
  });

  io.on("connection", (socket) => {
    let authenticatedUserId: number | null = null;

    socket.on("authenticate", async ({ token }: { token: string }) => {
      try {
        const payload = verifyToken(token);
        authenticatedUserId = payload.userId;
        socket.join(`user:${authenticatedUserId}`);

        await db.update(usersTable).set({ isOnline: true }).where(eq(usersTable.id, authenticatedUserId));
        io!.emit("user_status", { userId: authenticatedUserId, isOnline: true, lastSeen: null });

        logger.info({ userId: authenticatedUserId }, "Socket authenticated");
      } catch {
        socket.emit("auth_error", { error: "Invalid token" });
      }
    });

    socket.on("join_conversation", ({ conversationId }: { conversationId: number }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("join_group", ({ groupId }: { groupId: number }) => {
      socket.join(`group:${groupId}`);
    });

    socket.on("typing", ({ conversationId, groupId, isTyping }: { conversationId?: number; groupId?: number; isTyping: boolean }) => {
      if (!authenticatedUserId) return;
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit("typing", { userId: authenticatedUserId, conversationId, isTyping });
      }
      if (groupId) {
        socket.to(`group:${groupId}`).emit("typing", { userId: authenticatedUserId, groupId, isTyping });
      }
    });

    socket.on("disconnect", async () => {
      if (authenticatedUserId) {
        const lastSeen = new Date();
        await db.update(usersTable).set({ isOnline: false, lastSeen }).where(eq(usersTable.id, authenticatedUserId));
        io!.emit("user_status", { userId: authenticatedUserId, isOnline: false, lastSeen: lastSeen.toISOString() });
        logger.info({ userId: authenticatedUserId }, "Socket disconnected");
      }
    });
  });

  return io;
}
