import { Router } from "express";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { db, conversationsTable, conversationParticipantsTable, usersTable, messagesTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { serializeUser } from "../lib/userSerializer";
import { serializeMessage } from "./messages";

const router = Router();

async function buildConversation(convId: number, meId: number) {
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, convId) });
  if (!conv) return null;

  const participants = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, convId));

  const myParticipant = participants.find(p => p.userId === meId);
  const otherParticipant = participants.find(p => p.userId !== meId);

  let otherUser = null;
  if (otherParticipant) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, otherParticipant.userId));
    otherUser = u ? serializeUser(u) : null;
  }

  const messages = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), isNull(messagesTable.groupId)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  let lastMessage = null;
  if (messages.length > 0) {
    lastMessage = await serializeMessage(messages[0], meId);
  }

  const lastReadAt = myParticipant?.lastReadAt;
  let unreadCount = 0;
  if (lastReadAt) {
    const unread = await db.select().from(messagesTable).where(
      and(eq(messagesTable.conversationId, convId), eq(messagesTable.isDeleted, false))
    );
    unreadCount = unread.filter(m => m.senderId !== meId && m.createdAt > lastReadAt).length;
  } else {
    const unread = await db.select().from(messagesTable).where(
      and(eq(messagesTable.conversationId, convId), eq(messagesTable.isDeleted, false))
    );
    unreadCount = unread.filter(m => m.senderId !== meId).length;
  }

  return {
    id: conv.id,
    type: conv.type,
    otherUser,
    lastMessage,
    unreadCount,
    isPinned: myParticipant?.isPinned ?? false,
    isArchived: myParticipant?.isArchived ?? false,
    theme: myParticipant?.theme ?? null,
    createdAt: conv.createdAt.toISOString(),
  };
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const myParticipations = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, meId));

  const results = await Promise.all(myParticipations.map(p => buildConversation(p.conversationId, meId)));
  const valid = results.filter(Boolean);
  res.json(valid);
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const { otherUserId } = req.body;
  if (!otherUserId) { res.status(400).json({ error: "otherUserId is required" }); return; }

  // Check if DM already exists
  const myConvs = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, meId));

  for (const myConv of myConvs) {
    const others = await db.select().from(conversationParticipantsTable)
      .where(and(eq(conversationParticipantsTable.conversationId, myConv.conversationId), eq(conversationParticipantsTable.userId, otherUserId)));
    if (others.length > 0) {
      const result = await buildConversation(myConv.conversationId, meId);
      res.json(result);
      return;
    }
  }

  const [conv] = await db.insert(conversationsTable).values({ user1Id: meId, user2Id: otherUserId }).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: meId },
    { conversationId: conv.id, userId: otherUserId },
  ]);

  const result = await buildConversation(conv.id, meId);
  res.json(result);
});

router.get("/conversations/:conversationId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const result = await buildConversation(convId, meId);
  if (!result) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.json(result);
});

router.delete("/conversations/:conversationId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  await db.delete(conversationParticipantsTable).where(
    and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, meId))
  );
  res.sendStatus(204);
});

router.patch("/conversations/:conversationId/pin", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const { pinned } = req.body;
  await db.update(conversationParticipantsTable).set({ isPinned: pinned })
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, meId)));
  const result = await buildConversation(convId, meId);
  res.json(result);
});

router.patch("/conversations/:conversationId/archive", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const { archived } = req.body;
  await db.update(conversationParticipantsTable).set({ isArchived: archived })
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, meId)));
  const result = await buildConversation(convId, meId);
  res.json(result);
});

router.patch("/conversations/:conversationId/theme", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  const { theme } = req.body;
  await db.update(conversationParticipantsTable).set({ theme })
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, meId)));
  const result = await buildConversation(convId, meId);
  res.json(result);
});

router.post("/conversations/:conversationId/read", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const convId = parseInt(Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId, 10);
  await db.update(conversationParticipantsTable).set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, meId)));
  res.json({ success: true });
});

export { buildConversation };
export default router;
