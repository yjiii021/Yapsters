import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, usersTable, messagesTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { serializeUser } from "../lib/userSerializer";
import { serializeMessage } from "./messages";
import { getIo } from "../lib/socket";

const router = Router();

async function buildGroup(groupId: number, meId: number) {
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return null;

  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const membersWithUsers = await Promise.all(members.map(async (m) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId));
    return { userId: m.userId, user: u ? serializeUser(u) : null, role: m.role };
  }));

  const myMember = members.find(m => m.userId === meId);

  const lastMsgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.groupId, groupId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  let lastMessage = null;
  if (lastMsgs.length > 0) {
    lastMessage = await serializeMessage(lastMsgs[0], meId);
  }

  const lastReadAt = myMember?.lastReadAt;
  const allMsgs = await db.select().from(messagesTable).where(and(eq(messagesTable.groupId, groupId), eq(messagesTable.isDeleted, false)));
  const unreadCount = lastReadAt
    ? allMsgs.filter(m => m.senderId !== meId && m.createdAt > lastReadAt).length
    : allMsgs.filter(m => m.senderId !== meId).length;

  return {
    id: group.id,
    name: group.name,
    avatarUrl: group.avatarUrl ?? null,
    description: group.description ?? null,
    createdById: group.createdById,
    members: membersWithUsers,
    lastMessage,
    unreadCount,
    isPinned: myMember?.isPinned ?? false,
    isArchived: myMember?.isArchived ?? false,
    theme: myMember?.theme ?? null,
    createdAt: group.createdAt.toISOString(),
  };
}

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const myMemberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, meId));
  const results = await Promise.all(myMemberships.map(m => buildGroup(m.groupId, meId)));
  res.json(results.filter(Boolean));
});

router.post("/groups", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const { name, description, avatarUrl, memberIds } = req.body;
  if (!name) { res.status(400).json({ error: "Group name is required" }); return; }

  const [group] = await db.insert(groupsTable).values({ name, description, avatarUrl, createdById: meId }).returning();

  const allMemberIds = Array.from(new Set([meId, ...(memberIds || [])]));
  await db.insert(groupMembersTable).values(
    allMemberIds.map((uid: number) => ({ groupId: group.id, userId: uid, role: uid === meId ? "admin" : "member" }))
  );

  const result = await buildGroup(group.id, meId);
  res.status(201).json(result);
});

router.get("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const result = await buildGroup(groupId, meId);
  if (!result) { res.status(404).json({ error: "Group not found" }); return; }
  res.json(result);
});

router.patch("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const { name, description, avatarUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (name != null) updates.name = name;
  if (description != null) updates.description = description;
  if (avatarUrl != null) updates.avatarUrl = avatarUrl;

  await db.update(groupsTable).set(updates).where(eq(groupsTable.id, groupId));
  const result = await buildGroup(groupId, meId);
  res.json(result);
});

router.post("/groups/:groupId/members", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const { userId } = req.body;

  const existing = await db.select().from(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
  if (existing.length === 0) {
    await db.insert(groupMembersTable).values({ groupId, userId, role: "member" });
  }

  const result = await buildGroup(groupId, meId);
  res.json(result);
});

router.delete("/groups/:groupId/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  const result = await buildGroup(groupId, meId);
  res.json(result);
});

router.post("/groups/:groupId/leave", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, meId)));
  res.json({ success: true });
});

// Group messages
router.get("/groups/:groupId/messages", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.groupId, groupId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(100);
  const serialized = await Promise.all(msgs.reverse().map(m => serializeMessage(m, meId)));
  res.json(serialized);
});

router.post("/groups/:groupId/messages", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const { content, type, mediaUrl, replyToId } = req.body;

  const [msg] = await db.insert(messagesTable).values({
    groupId,
    senderId: meId,
    content: content ?? null,
    type: type ?? "text",
    mediaUrl: mediaUrl ?? null,
    replyToId: replyToId ?? null,
    reactions: [],
    readBy: [],
  }).returning();

  const serialized = await serializeMessage(msg, meId);

  try {
    const io = getIo();
    io.to(`group:${groupId}`).emit("new_message", { message: serialized, groupId });
  } catch { /* ignore */ }

  res.status(201).json(serialized);
});

router.delete("/groups/:groupId/messages/:messageId", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg || msg.senderId !== meId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(messagesTable).set({ isDeleted: true, content: null }).where(eq(messagesTable.id, msgId));

  try {
    const io = getIo();
    io.to(`group:${groupId}`).emit("message_deleted", { messageId: msgId, groupId });
  } catch { /* ignore */ }

  res.sendStatus(204);
});

router.post("/groups/:groupId/messages/:messageId/react", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const { emoji } = req.body;

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  const reactions = (msg.reactions as Array<{ emoji: string; userId: number }>) || [];
  const existing = reactions.findIndex(r => r.emoji === emoji && r.userId === meId);
  const updated = existing >= 0 ? reactions.filter((_, i) => i !== existing) : [...reactions, { emoji, userId: meId }];

  const [updatedMsg] = await db.update(messagesTable).set({ reactions: updated }).where(eq(messagesTable.id, msgId)).returning();
  const serialized = await serializeMessage(updatedMsg, meId);

  try {
    const io = getIo();
    io.to(`group:${groupId}`).emit("message_reaction", { messageId: msgId, reactions: serialized.reactions, groupId });
  } catch { /* ignore */ }

  res.json(serialized);
});

router.patch("/groups/:groupId/messages/:messageId/pin", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const msgId = parseInt(Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId, 10);
  const { pinned } = req.body;
  const [updatedMsg] = await db.update(messagesTable).set({ isPinned: pinned }).where(eq(messagesTable.id, msgId)).returning();
  const serialized = await serializeMessage(updatedMsg, meId);
  res.json(serialized);
});

router.get("/groups/:groupId/pinned", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.groupId, groupId), eq(messagesTable.isPinned, true), eq(messagesTable.isDeleted, false)));
  const serialized = await Promise.all(msgs.map(m => serializeMessage(m, meId)));
  res.json(serialized);
});

router.post("/groups/:groupId/read", requireAuth, async (req, res): Promise<void> => {
  const meId = getUserId(req);
  const groupId = parseInt(Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId, 10);
  await db.update(groupMembersTable).set({ lastReadAt: new Date() })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, meId)));
  res.json({ success: true });
});

export default router;
