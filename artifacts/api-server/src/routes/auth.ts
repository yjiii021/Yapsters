import { Router } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable, settingsTable } from "@workspace/db";
import { signToken, requireAuth, getUserId } from "../lib/auth";
import { serializeUser } from "../lib/userSerializer";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, displayName, username } = req.body;
  if (!email || !password || !displayName || !username) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Invalid fields" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (existing) {
    res.status(409).json({ error: "This email is already registered. Please log in instead." });
    return;
  }

  const [existingUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim()));
  if (existingUsername) {
    res.status(409).json({ error: "This username is already taken. Please choose a different one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase().trim(),
    passwordHash,
    displayName: displayName.trim(),
    username: username.toLowerCase().trim(),
    isOnline: true,
  }).returning();

  await db.insert(settingsTable).values({ userId: user.id });

  const token = signToken(user.id);
  res.status(201).json({ token, user: serializeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.update(usersTable).set({ isOnline: true }).where(eq(usersTable.id, user.id));

  const token = signToken(user.id);
  res.json({ token, user: serializeUser({ ...user, isOnline: true }) });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

export default router;
