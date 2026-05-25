import { Router } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { serializeUser } from "../lib/userSerializer";
import type { Message } from "@workspace/db";
import { getIo } from "../lib/socket";

const router = Router();

export async function serializeMessage(msg: Message, _meId?: number) {
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId));

  let replyTo = null;
  if (msg.replyToId) {
    const [reply] = await db.select().from(messagesTable).where(eq(messagesTable.id, msg.replyToId));
    if (reply) {
      const [replySender] = await db.select().from(usersTable).where(eq(usersTable.id, reply.senderId));
      replyTo = {
        id: reply.id,
        senderId: reply.senderId,
        sender: replySender ? serializeUser(replySender) : null,
        content: reply.isDeleted ? null : reply.content,
        type: reply.type,
        mediaUrl: reply.mediaUrl ?? null,
        replyToId: null,
        replyTo: null,
        reactions: [],
        readBy: [],
        isPinned: reply.isPinned,
        isDeleted: reply.isDeleted,
        createdAt: reply.createdAt.toISOString(),
      };
    }
  }

  const reactions = (msg.reactions as Array<{ emoji: string; userId: number }>) || [];
  const readBy = (msg.readBy as number[]) || [];

  const readByUsers = await Promise.all(
    readBy.map(async (uid) => {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
      return u ? serializeUser(u) : null;
    })
  );

  const reactionsWithUsers = await Promise.all(
    reactions.map(async (r) => {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
      return { emoji: r.emoji, userId: r.userId, user: u ? serializeUser(u) : null };
    })
  );

  return {
    id: msg.id,
    senderId: msg.senderId,
    sender: sender ? serializeUser(sender) : null,
    content: msg.isDeleted ? null : msg.content,
    type: msg.type,
    mediaUrl: msg.mediaUrl ?? null,
    replyToId: msg.replyToId ?? null,
    replyTo,
    reactions: reactionsWithUsers,
    readBy: readByUsers.filter(Boolean),
    isPinned: msg.isPinned,
    isDeleted: msg.isDeleted,
    createdAt: msg.createdAt.toISOString(),
  };
}

// List messages in a conversation
router.get("/conversations/:conversationId/messages", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const meId = getUserId(req);
  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), isNull(messagesTable.groupId)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(100);

  const serialized = await Promise.all(msgs.reverse().map(m => serializeMessage(m, meId)));
  res.json(serialized);
});

// Send message in a conversation
router.post("/conversations/:conversationId/messages", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const { content, type, mediaUrl, replyToId } = req.body;

  const [msg] = await db.insert(messagesTable).values({
    conversationId: convId,
    senderId: meId,
    content: content ?? null,
    type: type ?? "text",
    mediaUrl: mediaUrl ?? null,
    replyToId: replyToId ?? null,
    reactions: [],
    readBy: [],
  }).returning();

  const serialized = await serializeMessage(msg, meId);

  // Emit via socket
  try {
    const io = getIo();
    io.to(`conversation:${convId}`).emit("new_message", { message: serialized, conversationId: convId });
  } catch { /* socket not yet initialized */ }

  res.status(201).json(serialized);
});

// Delete a message
router.delete("/conversations/:conversationId/messages/:messageId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg || msg.senderId !== meId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(messagesTable).set({ isDeleted: true, content: null }).where(eq(messagesTable.id, msgId));

  try {
    const io = getIo();
    io.to(`conversation:${msg.conversationId}`).emit("message_deleted", { messageId: msgId, conversationId: msg.conversationId });
  } catch { /* ignore */ }

  res.sendStatus(204);
});

// React to a message
router.post("/conversations/:conversationId/messages/:messageId/react", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const { emoji } = req.body;

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  const reactions = (msg.reactions as Array<{ emoji: string; userId: number }>) || [];
  const existing = reactions.findIndex(r => r.emoji === emoji && r.userId === meId);
  let updated;
  if (existing >= 0) {
    updated = reactions.filter((_, i) => i !== existing);
  } else {
    updated = [...reactions, { emoji, userId: meId }];
  }

  const [updatedMsg] = await db.update(messagesTable).set({ reactions: updated }).where(eq(messagesTable.id, msgId)).returning();
  const serialized = await serializeMessage(updatedMsg, meId);

  try {
    const io = getIo();
    io.to(`conversation:${convId}`).emit("message_reaction", { messageId: msgId, reactions: serialized.reactions, conversationId: convId });
  } catch { /* ignore */ }

  res.json(serialized);
});

// Pin a message
router.patch("/conversations/:conversationId/messages/:messageId/pin", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);
  const { pinned } = req.body;

  const [updatedMsg] = await db.update(messagesTable).set({ isPinned: pinned }).where(eq(messagesTable.id, msgId)).returning();
  const serialized = await serializeMessage(updatedMsg, meId);
  res.json(serialized);
});

// List pinned messages
router.get("/conversations/:conversationId/pinned", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), eq(messagesTable.isPinned, true), eq(messagesTable.isDeleted, false)));
  const serialized = await Promise.all(msgs.map(m => serializeMessage(m, meId)));
  res.json(serialized);
});

export default router;
