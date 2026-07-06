export type Role = "admin" | "user";

export type SessionInfo = { loggedIn: true; userId: number; username: string; role: Role } | { loggedIn: false };

export type AdminUser = {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
};
