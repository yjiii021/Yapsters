# Yapster

A real-time full-stack chat app with private messaging, group chats, reactions, typing indicators, presence, and media uploads.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui, Wouter router, Zustand auth store, TanStack Query
- API: Express 5, Socket.io (path: `/ws/socket.io`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (stored in localStorage as `yapster_token`), bcrypt passwords
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (users, conversations, conversation_participants, groups, group_members, messages, settings)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for generated hooks)
- `lib/api-client-react/src/` — generated hooks + custom-fetch with Bearer auth
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/socket.ts` — Socket.io server with auth, typing, presence
- `artifacts/yapster/src/` — React frontend
  - `hooks/use-auth-store.ts` — Zustand store for JWT token
  - `lib/socket.ts` — Socket.io client manager + `useSocket` hook
  - `pages/` — login, register, chat (layout + area), profile, settings
  - `components/auth/require-auth.tsx` — protected route wrapper
  - `components/chat/chat-area.tsx` — message list + send form

## Architecture decisions

- JWT stored in localStorage (not cookies) to support Socket.io auth via `authenticate` event
- Socket.io path is `/ws/socket.io` on both server and client; the proxy routes `/ws` to the API server
- Messages support `reactions` and `readBy` as JSONB arrays in Postgres
- DM conversations route IDs are prefixed `dm_<id>`, groups use `group_<id>` in the URL
- Custom-fetch automatically attaches `Authorization: Bearer` header from localStorage token

## Product

- Register / Login with email + password
- Sidebar with Chats and Groups tabs, search bar, online presence indicators
- Mobile-responsive: sidebar hides when a chat is open, back button returns to list
- Chat area: send messages, real-time delivery via Socket.io, timestamps
- Settings: dark/light mode toggle, display name editing, push notifications toggle, logout
- Full REST API + Socket.io real-time events: `new_message`, `message_deleted`, `message_reaction`, `typing`, `user_status`

## User preferences

- Default accent color: pink (`--primary: 330 81% 60%`)

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` before editing frontend hooks
- Socket.io client must use `path: '/ws/socket.io'` — not `/ws` alone
- The `getIo()` helper throws if Socket.io isn't initialized; route handlers catch this gracefully
- Express 5 wildcard routes use `/{*splat}` syntax

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
