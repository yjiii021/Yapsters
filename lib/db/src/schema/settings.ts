import { pgTable, serial, timestamp, boolean, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  showOnlineStatus: boolean("show_online_status").notNull().default(true),
  showLastSeen: text("show_last_seen").notNull().default("everyone"),
  showReadReceipts: boolean("show_read_receipts").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  darkMode: boolean("dark_mode").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
