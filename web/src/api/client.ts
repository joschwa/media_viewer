import type {
  AdminUser,
  MediaListItem,
  MediaPreferences,
  OrderMode,
  Role,
  ScanResult,
  SessionInfo,
  Tag,
  UploadResponse,
  Visibility,
} from "@media_viewer/shared";

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

// Deliberately bypasses request()'s JSON Content-Type — a FormData body needs the browser to set
// its own multipart boundary header instead.
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", credentials: "include", body: formData });
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
  updateVisibility: (id: number, visibility: Visibility) =>
    request<{ id: number; visibility: Visibility }>(`/media/${id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ visibility }),
    }),
  updatePreferences: (
    id: number,
    body: { isFavorite?: boolean; weight?: number; isExcluded?: boolean; tagIds?: number[] },
  ) => request<MediaPreferences>(`/media/${id}/preferences`, { method: "PATCH", body: JSON.stringify(body) }),
  listTags: () => request<Tag[]>("/tags"),
  createTag: (name: string) => request<Tag>("/tags", { method: "POST", body: JSON.stringify({ name }) }),
  triggerScan: () => request<ScanResult>("/admin/scan", { method: "POST" }),
  uploadMedia: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    return uploadRequest<UploadResponse>("/media/upload", formData);
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/session/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  deleteMedia: (id: number) => request<{ id: number; deleted: boolean }>(`/media/${id}`, { method: "DELETE" }),
  deleteUser: (id: number) => request<{ id: number; deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  adminResetPassword: (id: number, newPassword: string) =>
    request<{ ok: boolean }>(`/admin/users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    }),
  transferMedia: (id: number, toUserId: number) =>
    request<{ transferred: number }>(`/admin/users/${id}/transfer-media`, {
      method: "POST",
      body: JSON.stringify({ toUserId }),
    }),
};
