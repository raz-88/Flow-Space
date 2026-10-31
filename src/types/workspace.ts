import type { Timestamp, FieldValue } from 'firebase/firestore';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  role: WorkspaceRole;
  joinedAt: Timestamp | FieldValue | null;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  type?: string;
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  memberCount: number;
  status: 'active' | 'archived';
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
}

export type InvitationStatus = 'pending' | 'active' | 'accepted' | 'declined' | 'revoked' | 'expired';

export type InvitationType = 'email' | 'link' | 'code';

export interface WorkspaceInvitation {
  id: string;
  type?: InvitationType;
  workspaceId: string;
  workspaceName: string;
  inviterUid: string;
  inviterName: string;
  recipientEmail?: string;
  recipientUid?: string;
  token?: string;
  code?: string;
  role: 'admin' | 'member';
  status: InvitationStatus;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
  expiresAt?: Timestamp | FieldValue | null;
  maxUses?: number | null;
  usedCount?: number;
  usedBy?: string[];
}

export type SharedTaskPriority = 'low' | 'medium' | 'high';
export type SharedTaskStatus = 'pending' | 'in_progress' | 'completed';
export type SharedTaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface SharedTask {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  priority: SharedTaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // Optional HH:mm
  status: SharedTaskStatus;
  category?: string;
  assignedToUid?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  createdByUid: string;
  createdByName: string;
  reminderMinutes?: number | null;
  snoozedUntil?: string | null;
  recurrence?: SharedTaskRecurrence;
  recurrenceEndDate?: string | null;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
}

export interface TaskComment {
  id: string;
  workspaceId: string;
  taskId: string;
  authorUid: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
}

export type WorkspaceActionType =
  | 'workspace_created'
  | 'workspace_updated'
  | 'member_invited'
  | 'invitation_link_generated'
  | 'join_code_generated'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'invitation_revoked'
  | 'member_role_updated'
  | 'member_removed'
  | 'member_left'
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'task_reassigned'
  | 'task_deleted'
  | 'comment_added'
  | 'comment_deleted';

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  action: WorkspaceActionType;
  details: string;
  timestamp: Timestamp | FieldValue | null;
}
