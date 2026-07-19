export type Role = "admin" | "user";

export type SessionInfo = { loggedIn: true; userId: number; username: string; role: Role } | { loggedIn: false };

export type AdminUser = {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
};

export type MediaType = "image" | "video";
export type Visibility = "private" | "public";
export type OrderMode = "captured_at" | "filename" | "none";

export type Tag = {
  id: number;
  name: string;
};

export type MediaListItem = {
  id: number;
  mediaType: MediaType;
  originalFilename: string;
  width: number;
  height: number;
  durationSeconds: number | null;
  capturedAt: string | null;
  importedAt: string;
  ownerId: number;
  visibility: Visibility;
  isFavorite: boolean;
  weight: number;
  isExcluded: boolean;
  tags: Tag[];
};

export type MediaPreferences = {
  isFavorite: boolean;
  weight: number;
  isExcluded: boolean;
  tags: Tag[];
};
