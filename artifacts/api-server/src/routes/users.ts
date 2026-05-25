import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, ne } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { serializeUser } from "../lib/userSerializer";

const router = Router();

router.get("/users", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable);
  res.json(users.map(serializeUser));
});

router.get("/users/me/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

router.patch("/users/me/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { displayName, bio, avatarUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (displayName != null) updates.displayName = displayName;
  if (bio != null) updates.bio = bio;
  if (avatarUrl != null) updates.avatarUrl = avatarUrl;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  res.json(serializeUser(updated));
});

router.patch("/users/me/password", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both current and new password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

router.patch("/users/me/status", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { isOnline } = req.body;
  const [updated] = await db.update(usersTable)
    .set({ isOnline, lastSeen: isOnline ? undefined : new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json(serializeUser(updated));
});

router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

export default router;
