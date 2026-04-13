import { apiErrorMessage, authHeaders, getApiUrl, isRecord } from "./api";

export async function deleteListing(listingId: string, token: string): Promise<void> {
  const response = await fetch(getApiUrl(`/api/listing?id=${encodeURIComponent(listingId)}`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(raw, "Failed to delete listing"));
  }
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  listing_id: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(token: string, signal?: AbortSignal): Promise<NotificationItem[]> {
  const response = await fetch(getApiUrl("/api/notifications"), {
    method: "GET",
    headers: authHeaders(token),
    signal,
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(raw, "Failed to load notifications"));
  }
  if (!isRecord(raw) || !Array.isArray(raw.notifications)) return [];
  return raw.notifications.filter(
    (n): n is NotificationItem =>
      isRecord(n) &&
      typeof n.id === "string" &&
      typeof n.title === "string" &&
      typeof n.message === "string",
  );
}

export async function fetchUnreadNotificationCount(token: string, signal?: AbortSignal): Promise<number> {
  const response = await fetch(getApiUrl("/api/notifications/count"), {
    method: "GET",
    headers: authHeaders(token),
    signal,
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(raw, "Failed to load notification count"));
  }
  if (!isRecord(raw) || typeof raw.unread_count !== "number") return 0;
  return raw.unread_count;
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  const response = await fetch(getApiUrl("/api/notifications/read-all"), {
    method: "PUT",
    headers: authHeaders(token),
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(raw, "Failed to mark notifications as read"));
  }
}

export async function markNotificationRead(token: string, notificationId: string): Promise<void> {
  const response = await fetch(getApiUrl(`/api/notifications/${encodeURIComponent(notificationId)}/read`), {
    method: "PUT",
    headers: authHeaders(token),
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(raw, "Failed to mark notification as read"));
  }
}
