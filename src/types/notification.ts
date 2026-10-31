import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NotificationType =
  | 'workspace_invitation'
  | 'workspace_joined'
  | 'task_assignment'
  | 'task_reassignment'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'membership_change'
  | 'task_comment';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedWorkspaceId?: string;
  relatedWorkspaceName?: string;
  relatedTaskId?: string;
  relatedTaskTitle?: string;
  link?: string;
  isRead: boolean;
  createdAt: Timestamp | FieldValue | null;
}

