import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserTasks } from '../services/taskService';
import { subscribeToUserWorkspaces, subscribeToWorkspaceTasks } from '../services/workspaceService';
import { createNotification } from '../services/notificationService';
import type { Task } from '../types/task';
import type { SharedTask } from '../types/workspace';

/**
 * In-App Task Reminder and Deadline Watcher Hook
 *
 * Scans personal tasks and assigned team workspace tasks every 60 seconds.
 * Triggers deterministic in-app notifications when tasks enter their configured
 * reminder window or become overdue.
 */
export function useTaskReminders(): void {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser?.uid) return;

    let personalTasks: Task[] = [];
    let teamTasks: (SharedTask & { workspaceName: string })[] = [];

    // 1. Subscribe to Personal Tasks
    const unsubPersonal = subscribeToUserTasks(
      currentUser.uid,
      (tasks) => {
        personalTasks = tasks;
      },
      () => {}
    );

    // 2. Subscribe to Workspaces & Assigned Team Tasks
    const workspaceUnsubs: (() => void)[] = [];
    const unsubWorkspaces = subscribeToUserWorkspaces(
      currentUser.uid,
      (workspaces) => {
        workspaceUnsubs.forEach((u) => u());
        workspaceUnsubs.length = 0;

        workspaces.forEach((ws) => {
          const u = subscribeToWorkspaceTasks(
            ws.id,
            (wsTasks) => {
              const assigned = wsTasks
                .filter((t) => t.assignedToUid === currentUser.uid)
                .map((t) => ({ ...t, workspaceName: ws.name }));
              teamTasks = teamTasks
                .filter((t) => t.workspaceId !== ws.id)
                .concat(assigned);
            },
            () => {}
          );
          workspaceUnsubs.push(u);
        });
      },
      () => {}
    );

    // Check deadlines and reminders
    const checkReminders = async () => {
      const now = new Date();
      const nowMs = now.getTime();
      const todayStr = now.toISOString().split('T')[0];

      // Check Personal Tasks
      for (const t of personalTasks) {
        if (t.status === 'completed') continue;

        // Check if snoozed
        if (t.snoozedUntil && new Date(t.snoozedUntil).getTime() > nowMs) {
          continue;
        }

        const dueDateTimeStr = t.dueTime ? `${t.dueDate}T${t.dueTime}:00` : `${t.dueDate}T09:00:00`;
        const dueMs = new Date(dueDateTimeStr).getTime();
        if (isNaN(dueMs)) continue;

        // Configured reminder trigger
        if (t.reminderMinutes !== null && t.reminderMinutes !== undefined) {
          const reminderMs = dueMs - t.reminderMinutes * 60 * 1000;
          if (nowMs >= reminderMs && nowMs < dueMs + 3600000) {
            await createNotification(currentUser.uid, {
              type: 'task_due_soon',
              title: 'Task Reminder',
              message: `Reminder: "${t.title}" is due ${t.dueDate === todayStr ? 'today' : `on ${t.dueDate}`} ${t.dueTime ? `at ${t.dueTime}` : ''}.`,
              relatedTaskId: t.id,
              relatedTaskTitle: t.title,
              link: '/dashboard',
              deterministicKey: `reminder_personal_${t.id}_${t.dueDate}_${t.reminderMinutes}`,
            });
          }
        }

        // Overdue notification
        if (t.dueDate < todayStr) {
          await createNotification(currentUser.uid, {
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `"${t.title}" was due on ${t.dueDate} and is still pending.`,
            relatedTaskId: t.id,
            relatedTaskTitle: t.title,
            link: '/dashboard',
            deterministicKey: `overdue_personal_${t.id}_${t.dueDate}`,
          });
        }
      }

      // Check Team Tasks
      for (const t of teamTasks) {
        if (t.status === 'completed') continue;

        if (t.snoozedUntil && new Date(t.snoozedUntil).getTime() > nowMs) {
          continue;
        }

        const dueDateTimeStr = t.dueTime ? `${t.dueDate}T${t.dueTime}:00` : `${t.dueDate}T09:00:00`;
        const dueMs = new Date(dueDateTimeStr).getTime();
        if (isNaN(dueMs)) continue;

        if (t.reminderMinutes !== null && t.reminderMinutes !== undefined) {
          const reminderMs = dueMs - t.reminderMinutes * 60 * 1000;
          if (nowMs >= reminderMs && nowMs < dueMs + 3600000) {
            await createNotification(currentUser.uid, {
              type: 'task_due_soon',
              title: `Workspace Task Due Soon (${t.workspaceName})`,
              message: `"${t.title}" is due ${t.dueDate === todayStr ? 'today' : `on ${t.dueDate}`} ${t.dueTime ? `at ${t.dueTime}` : ''}.`,
              relatedWorkspaceId: t.workspaceId,
              relatedWorkspaceName: t.workspaceName,
              relatedTaskId: t.id,
              relatedTaskTitle: t.title,
              link: `/workspaces/${t.workspaceId}?tab=tasks`,
              deterministicKey: `reminder_team_${t.id}_${t.dueDate}_${t.reminderMinutes}`,
            });
          }
        }

        // Overdue notification
        if (t.dueDate < todayStr) {
          await createNotification(currentUser.uid, {
            type: 'task_overdue',
            title: `Overdue Task in ${t.workspaceName}`,
            message: `"${t.title}" was due on ${t.dueDate} and needs action.`,
            relatedWorkspaceId: t.workspaceId,
            relatedWorkspaceName: t.workspaceName,
            relatedTaskId: t.id,
            relatedTaskTitle: t.title,
            link: `/workspaces/${t.workspaceId}?tab=tasks`,
            deterministicKey: `overdue_team_${t.id}_${t.dueDate}`,
          });
        }
      }
    };

    // Run check after initial data arrival (3s), and every 60s thereafter
    const initialTimer = setTimeout(checkReminders, 3000);
    const interval = setInterval(checkReminders, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      unsubPersonal();
      unsubWorkspaces();
      workspaceUnsubs.forEach((u) => u());
    };
  }, [currentUser?.uid]);
}

