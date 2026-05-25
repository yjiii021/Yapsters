import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";
import { groupsTable } from "./groups";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  content: text("content"),
  type: text("type").notNull().default("text"), // "text" | "image" | "voice"
  mediaUrl: text("media_url"),
  replyToId: integer("reply_to_id"),
  reactions: jsonb("reactions").notNull().default([]),
  readBy: jsonb("read_by").notNull().default([]),
  isPinned: boolean("is_pinned").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
