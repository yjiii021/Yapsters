import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  username: text("username").notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  showOnlineStatus: boolean("show_online_status").notNull().default(true),
  showLastSeen: text("show_last_seen").notNull().default("everyone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
