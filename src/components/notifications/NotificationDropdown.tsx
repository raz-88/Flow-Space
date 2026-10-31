import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/notificationService';
import type { AppNotification } from '../../types/notification';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Inbox,
  UserPlus,
  UserCheck,
  Calendar,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const NotificationDropdown: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Subscribe to notifications
  useEffect(() => {
    if (!currentUser?.uid) {
      return;
    }

    const unsub = subscribeToUserNotifications(
      currentUser.uid,
      (items) => setNotifications(items),
      () => setNotifications([])
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!currentUser?.uid) return;

    if (!notif.isRead) {
      await markNotificationAsRead(currentUser.uid, notif.id);
    }

    setIsOpen(false);

    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser?.uid || unreadCount === 0) return;
    await markAllNotificationsAsRead(currentUser.uid);
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    if (!currentUser?.uid) return;
    await deleteNotification(currentUser.uid, notifId);
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'workspace_invitation':
        return <UserPlus className="w-4 h-4 text-[#635BFF]" />;
      case 'task_assignment':
      case 'task_reassignment':
        return <UserCheck className="w-4 h-4 text-[#2563EB]" />;
      case 'task_due_soon':
        return <Clock className="w-4 h-4 text-[#D97706]" />;
      case 'task_overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'task_completed':
        return <CheckCircle2 className="w-4 h-4 text-[#059669]" />;
      case 'task_comment':
        return <MessageSquare className="w-4 h-4 text-[#7C3AED]" />;
      default:
        return <Calendar className="w-4 h-4 text-slate-500" />;
    }
  };

  const getIconBg = (type: AppNotification['type']) => {
    switch (type) {
      case 'workspace_invitation':
      case 'task_comment':
        return 'bg-[#F0EAFE]';
      case 'task_assignment':
      case 'task_reassignment':
        return 'bg-[#E8F0FF]';
      case 'task_due_soon':
        return 'bg-[#FFF0E5]';
      case 'task_overdue':
        return 'bg-rose-50';
      case 'task_completed':
        return 'bg-[#E2F8EE]';
      default:
        return 'bg-slate-100';
    }
  };

  const formatTimestamp = (createdAt: AppNotification['createdAt']) => {
    if (!createdAt) return 'Just now';
    const seconds = (createdAt as { seconds?: number })?.seconds;
    if (!seconds) return 'Just now';

    const date = new Date(seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[#64748B] hover:text-[#172033] hover:bg-slate-100/70 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#635BFF]/20 cursor-pointer"
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#E7EAF0] shadow-2xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-[#E7EAF0] flex items-center justify-between bg-gradient-to-r from-slate-50 to-[#F0EAFE]/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#172033] tracking-tight">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-[#635BFF] hover:text-[#5145E5] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[#E7EAF0]/60">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2.5">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172033]">All caught up!</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  No new notifications right now.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 transition-colors cursor-pointer flex gap-3 text-left group ${
                    notif.isRead
                      ? 'bg-white hover:bg-slate-50/70'
                      : 'bg-[#F0EAFE]/25 hover:bg-[#F0EAFE]/40'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-7 h-7 rounded-lg ${getIconBg(
                        notif.type
                      )} flex items-center justify-center`}
                    >
                      {getIcon(notif.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          notif.isRead ? 'text-[#172033]' : 'text-[#172033] font-bold'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      {notif.relatedWorkspaceName ? (
                        <span className="text-[10px] font-medium text-[#635BFF] bg-[#F0EAFE] px-2 py-0.5 rounded-full border border-[#635BFF]/15">
                          {notif.relatedWorkspaceName}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentUser?.uid) {
                                markNotificationAsRead(currentUser.uid, notif.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-[#635BFF] rounded transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, notif.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
