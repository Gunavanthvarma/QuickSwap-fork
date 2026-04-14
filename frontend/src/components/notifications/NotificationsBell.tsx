import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useSignInRedirect } from "../../auth/useSignInRedirect";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../../lib/listingApi";
import "./notifications.css";

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const NotificationsBell: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const redirectToSignin = useSignInRedirect();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const n = await fetchUnreadNotificationCount(token);
      setUnreadCount(n);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const loadList = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchNotifications(token);
      setItems(list);
      await refreshCount();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [redirectToSignin, refreshCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshCount();
    const id = window.setInterval(() => void refreshCount(), 60_000);
    const onVis = () => void refreshCount();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshCount, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    void loadList();
  }, [open, loadList, isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleOpen = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return;
    }
    setOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not mark all as read");
    }
  };

  const handleItemActivate = async (n: NotificationItem) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    if (!n.is_read) {
      try {
        await markNotificationRead(token, n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (n.listing_id) {
      navigate(`/auction/${encodeURIComponent(n.listing_id)}`);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="notif-bell-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost-icon notif-bell-btn"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => void handleOpen()}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 ? (
          <span className="notif-bell-badge" aria-hidden>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div ref={panelRef} className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {items.some((n) => !n.is_read) ? (
              <button type="button" className="notif-mark-all" onClick={() => void handleMarkAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          {loading ? <div className="notif-panel-loading">Loading…</div> : null}
          {error ? (
            <div className="notif-panel-error" role="alert">
              {error}
            </div>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <div className="notif-panel-empty">No notifications yet.</div>
          ) : null}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notif-item ${n.is_read ? "notif-item--read" : ""}`}
                  onClick={() => void handleItemActivate(n)}
                >
                  <span className="notif-item-title">{n.title || "Notification"}</span>
                  <span className="notif-item-msg">{n.message}</span>
                  <span className="notif-item-time">{formatNotifTime(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
