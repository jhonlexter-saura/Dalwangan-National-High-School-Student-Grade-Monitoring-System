import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../context/ToastContext";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/schoolDataService";

function formatNotificationDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Notifications() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await getMyNotifications();
      setNotifications(result.notifications || []);
    } catch (error) {
      showToast(error.message || "Failed to load notifications.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadNotifications();
    const refreshTimer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const handleMarkAllRead = async () => {
    if (updating || unreadCount === 0) return;
    setUpdating(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    } catch (error) {
      showToast(error.message || "Failed to update notifications.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id);
        setNotifications((items) => items.map((item) =>
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        ));
      } catch (error) {
        showToast(error.message || "Failed to update notification.", "error");
      }
    }
    if (notification.link?.startsWith("/")) navigate(notification.link);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500">
              Updates about your grades and classes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={updating || unreadCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={17} />
          Mark all as read
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">You’re all caught up</p>
            <p className="mt-1 text-sm text-gray-500">New grade, class, and subject assignment updates will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <button
                key={notification._id}
                type="button"
                onClick={() => handleOpenNotification(notification)}
                className={`flex w-full gap-4 px-5 py-4 text-left transition hover:bg-gray-50 ${
                  notification.readAt ? "bg-white" : "bg-blue-50/60"
                }`}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-blue-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900">{notification.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-gray-600">{notification.message}</span>
                  <span className="mt-2 block text-xs text-gray-400">{formatNotificationDate(notification.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
