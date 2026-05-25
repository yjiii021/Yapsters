import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, usersTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";

const router = Router();

async function getOrCreateSettings(userId: number) {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({ userId }).returning();
  return created;
}

function serializeSettings(s: typeof settingsTable.$inferSelect) {
  return {
    userId: s.userId,
    showOnlineStatus: s.showOnlineStatus,
    showLastSeen: s.showLastSeen,
    showReadReceipts: s.showReadReceipts,
    pushNotifications: s.pushNotifications,
    darkMode: s.darkMode,
  };
}

router.get("/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const settings = await getOrCreateSettings(userId);
  res.json(serializeSettings(settings));
});

router.patch("/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { showOnlineStatus, showLastSeen, showReadReceipts, pushNotifications, darkMode } = req.body;

  await getOrCreateSettings(userId);

  const updates: Record<string, unknown> = {};
  if (showOnlineStatus != null) updates.showOnlineStatus = showOnlineStatus;
  if (showLastSeen != null) updates.showLastSeen = showLastSeen;
  if (showReadReceipts != null) updates.showReadReceipts = showReadReceipts;
  if (pushNotifications != null) updates.pushNotifications = pushNotifications;
  if (darkMode != null) updates.darkMode = darkMode;

  // Also sync privacy settings to user record
  if (showOnlineStatus != null || showLastSeen != null) {
    const userUpdates: Record<string, unknown> = {};
    if (showOnlineStatus != null) userUpdates.showOnlineStatus = showOnlineStatus;
    if (showLastSeen != null) userUpdates.showLastSeen = showLastSeen;
    await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, userId));
  }

  const [updated] = await db.update(settingsTable).set(updates).where(eq(settingsTable.userId, userId)).returning();
  res.json(serializeSettings(updated));
});

export default router;
