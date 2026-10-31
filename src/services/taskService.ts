import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Task, TaskRecurrence, TaskStatus } from '../types/task';

/**
 * References the tasks subcollection for a given authenticated user:
 * Firestore path: users/{userId}/tasks
 */
const getUserTasksCollection = (userId: string) => {
  return collection(db, 'users', userId, 'tasks');
};

/**
 * Calculates the next due date string (YYYY-MM-DD) based on recurrence frequency.
 */
export function calculateNextDueDate(
  currentDueDate: string,
  recurrence: TaskRecurrence
): string {
  if (!currentDueDate || recurrence === 'none') return currentDueDate;

  const parts = currentDueDate.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  if (recurrence === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (recurrence === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Subscribes to real-time updates for an authenticated user's tasks.
 * Results are ordered by dueDate ascending.
 */
export function subscribeToUserTasks(
  userId: string,
  onTasksUpdated: (tasks: Task[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const tasksRef = getUserTasksCollection(userId);
  const tasksQuery = query(tasksRef, orderBy('dueDate', 'asc'));

  return onSnapshot(
    tasksQuery,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId,
          title: data.title || '',
          description: data.description || '',
          priority: data.priority || 'medium',
          dueDate: data.dueDate || '',
          dueTime: data.dueTime || '',
          category: data.category || 'Personal',
          status: data.status || 'pending',
          reminderMinutes: data.reminderMinutes ?? null,
          snoozedUntil: data.snoozedUntil ?? null,
          recurrence: data.recurrence || 'none',
          recurrenceEndDate: data.recurrenceEndDate || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        } as Task;
      });
      onTasksUpdated(tasks);
    },
    (error) => {
      console.error('Error fetching tasks from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Creates a new personal task document in Firestore.
 */
export async function createTask(
  userId: string,
  taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const tasksRef = getUserTasksCollection(userId);
  const payload: Record<string, unknown> = {
    userId,
    title: taskData.title.trim(),
    description: taskData.description ? taskData.description.trim() : '',
    priority: taskData.priority,
    dueDate: taskData.dueDate,
    dueTime: taskData.dueTime ? taskData.dueTime.trim() : '',
    category: taskData.category || 'Personal',
    status: taskData.status || 'pending',
    reminderMinutes: taskData.reminderMinutes ?? null,
    snoozedUntil: taskData.snoozedUntil ?? null,
    recurrence: taskData.recurrence || 'none',
    recurrenceEndDate: taskData.recurrenceEndDate || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(tasksRef, payload);
  return docRef.id;
}

/**
 * Updates an existing task document in Firestore.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const taskDocRef = doc(db, 'users', userId, 'tasks', taskId);
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  Object.entries(updates).forEach(([key, val]) => {
    if (val !== undefined) {
      cleanUpdates[key] = val;
    }
  });

  await updateDoc(taskDocRef, cleanUpdates);
}

/**
 * Deletes a task from Firestore.
 */
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const taskDocRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskDocRef);
}

/**
 * Toggles a task status between completed and pending.
 * If the task is recurring and marked completed, generates the next predictable instance.
 */
export async function toggleTaskComplete(
  userId: string,
  task: Task
): Promise<void> {
  const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';

  // Mark current task completed/pending
  await updateTask(userId, task.id, {
    status: newStatus,
    snoozedUntil: null,
  });

  // If recurring and newly completed, spawn the next occurrence
  if (
    newStatus === 'completed' &&
    task.recurrence &&
    task.recurrence !== 'none'
  ) {
    const nextDate = calculateNextDueDate(task.dueDate, task.recurrence);

    // If an end date exists, check bounds
    if (task.recurrenceEndDate && nextDate > task.recurrenceEndDate) {
      return;
    }

    await createTask(userId, {
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: nextDate,
      dueTime: task.dueTime || '',
      category: task.category,
      status: 'pending',
      reminderMinutes: task.reminderMinutes,
      recurrence: task.recurrence,
      recurrenceEndDate: task.recurrenceEndDate || undefined,
    });
  }
}

/**
 * Snoozes a task reminder by a specified number of minutes.
 */
export async function snoozeTaskReminder(
  userId: string,
  taskId: string,
  minutesToAdd: number
): Promise<void> {
  const snoozeDate = new Date(Date.now() + minutesToAdd * 60 * 1000);
  await updateTask(userId, taskId, {
    snoozedUntil: snoozeDate.toISOString(),
  });
}
