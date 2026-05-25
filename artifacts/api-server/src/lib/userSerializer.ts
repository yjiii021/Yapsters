import type { User } from "@workspace/db";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
    showOnlineStatus: user.showOnlineStatus,
    showLastSeen: user.showLastSeen,
    createdAt: user.createdAt.toISOString(),
  };
}
