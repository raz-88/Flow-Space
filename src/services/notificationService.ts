import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  getDocs,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppNotification, NotificationType } from '../types/notification';

/**
 * Subscribes in real-time to a user's in-app notifications.
 */
export function subscribeToUserNotifications(
  userId: string,
  onNotificationsUpdated: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const notifsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotification[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId,
          type: data.type as NotificationType,
          title: data.title || '',
          message: data.message || '',
          relatedWorkspaceId: data.relatedWorkspaceId || undefined,
          relatedWorkspaceName: data.relatedWorkspaceName || undefined,
          relatedTaskId: data.relatedTaskId || undefined,
          relatedTaskTitle: data.relatedTaskTitle || undefined,
          link: data.link || undefined,
          isRead: Boolean(data.isRead),
          createdAt: data.createdAt || null,
        };
      });

      onNotificationsUpdated(items);
    },
    (error) => {
      console.error('Error listening to notifications:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Creates or updates an in-app notification with a deterministic key to prevent duplicate notifications.
 */
export async function createNotification(
  userId: string,
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    relatedWorkspaceId?: string;
    relatedWorkspaceName?: string;
    relatedTaskId?: string;
    relatedTaskTitle?: string;
    link?: string;
    deterministicKey?: string;
  }
): Promise<void> {
  if (!userId) return;

  try {
    const notifsRef = collection(db, 'users', userId, 'notifications');
    const docRef = notification.deterministicKey
      ? doc(notifsRef, notification.deterministicKey)
      : doc(notifsRef);

    // If deterministic key is provided, check if already dispatched to avoid duplicate writes and permission conflicts
    if (notification.deterministicKey) {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          // Already dispatched; do not overwrite or flip read status
          return;
        }
      } catch {
        // Continue if getDoc fails
      }
    }

    await setDoc(
      docRef,
      {
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedWorkspaceId: notification.relatedWorkspaceId || null,
        relatedWorkspaceName: notification.relatedWorkspaceName || null,
        relatedTaskId: notification.relatedTaskId || null,
        relatedTaskTitle: notification.relatedTaskTitle || null,
        link: notification.link || null,
        isRead: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to dispatch notification:', err);
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notifRef, {
    isRead: true,
  });
}

/**
 * Marks all unread notifications as read in a single batch.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notifsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifsRef, where('isRead', '==', false), limit(100));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { isRead: true });
  });

  await batch.commit();
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await deleteDoc(notifRef);
}

