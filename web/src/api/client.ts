import type { AdminUser, MediaListItem, OrderMode, Role, SessionInfo } from "@media_viewer/shared";

const BASE = "/api";

export function mediaUrl(id: number, kind: "original" | "thumbnail" | "preview"): string {
  return `${BASE}/media/${id}/${kind}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  getSession: () => request<SessionInfo>("/session"),
  login: (username: string, password: string) =>
    request<SessionInfo>("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ loggedOut: boolean }>("/logout", { method: "POST" }),
  listUsers: () => request<AdminUser[]>("/admin/users"),
  createUser: (username: string, password: string, role: Role) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify({ username, password, role }) }),
  listMedia: (orderBy: OrderMode = "captured_at") => request<MediaListItem[]>(`/media?orderBy=${orderBy}`),
};
