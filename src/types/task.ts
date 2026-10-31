import type { Timestamp, FieldValue } from 'firebase/firestore';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD format
  dueTime?: string; // Optional HH:mm format
  category: string;
  status: TaskStatus;
  reminderMinutes?: number | null; // e.g. 5, 15, 30, 60, 1440 minutes before deadline
  snoozedUntil?: string | null;
  recurrence?: TaskRecurrence;
  recurrenceEndDate?: string | null;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
}

export type TaskFilterTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

export interface TaskFormData {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  category: string;
  status: TaskStatus;
  reminderMinutes?: number | null;
  recurrence?: TaskRecurrence;
  recurrenceEndDate?: string;
}

export const DEFAULT_CATEGORIES = ['Personal', 'Work', 'Study'] as const;
