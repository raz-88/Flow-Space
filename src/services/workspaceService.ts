import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayRemove,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  SharedTask,
  SharedTaskRecurrence,
  WorkspaceActivity,
  WorkspaceActionType,
} from '../types/workspace';
import { createNotification } from './notificationService';
import { queueTaskAssignmentEmail } from './emailService';

/**
 * Calculates next due date (YYYY-MM-DD) for recurring shared tasks.
 */
export function calculateNextSharedDueDate(
  currentDueDate: string,
  recurrence: SharedTaskRecurrence
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
 * Subscribes in real-time to all workspaces where the user is a member.
 */
export function subscribeToUserWorkspaces(
  userId: string,
  onWorkspacesUpdated: (workspaces: Workspace[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const workspacesRef = collection(db, 'workspaces');
  const q = query(workspacesRef, where('memberIds', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const workspaces: Workspace[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Untitled Workspace',
          description: data.description || '',
          type: data.type || 'General',
          ownerId: data.ownerId || '',
          ownerName: data.ownerName || 'Unknown Owner',
          memberIds: data.memberIds || [],
          memberCount: data.memberCount || 1,
          status: data.status || 'active',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        } as Workspace;
      });

      // Sort client-side by updatedAt/createdAt descending
      workspaces.sort((a, b) => {
        const tA = (a.updatedAt as { seconds?: number })?.seconds || 0;
        const tB = (b.updatedAt as { seconds?: number })?.seconds || 0;
        return tB - tA;
      });

      onWorkspacesUpdated(workspaces);
    },
    (error) => {
      console.error('Error fetching user workspaces:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribes to a single workspace document in real time.
 */
export function subscribeToWorkspace(
  workspaceId: string,
  onWorkspaceUpdated: (workspace: Workspace | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, 'workspaces', workspaceId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onWorkspaceUpdated(null);
        return;
      }
      const data = snapshot.data();
      onWorkspaceUpdated({
        id: snapshot.id,
        name: data.name || '',
        description: data.description || '',
        type: data.type || 'General',
        ownerId: data.ownerId || '',
        ownerName: data.ownerName || '',
        memberIds: data.memberIds || [],
        memberCount: data.memberCount || 1,
        status: data.status || 'active',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      } as Workspace);
    },
    (error) => {
      console.error('Error subscribing to workspace:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Logs a workspace audit trail activity entry.
 */
export async function logWorkspaceActivity(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  action: WorkspaceActionType,
  details: string
): Promise<void> {
  try {
    const activityRef = collection(db, 'workspaces', workspaceId, 'activity');
    await addDoc(activityRef, {
      workspaceId,
      actorId: actor.uid,
      actorName: actor.displayName || 'Member',
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not log workspace activity:', err);
  }
}

/**
 * Creates a new workspace:
 * 1. Creates workspace document with creator as owner and memberIds = [creatorUid].
 * 2. Adds creator as member with role 'owner' in subcollection.
 * 3. Logs workspace_created activity.
 */
export async function createWorkspace(
  owner: { uid: string; displayName: string; email: string; photoURL?: string | null },
  data: { name: string; description?: string; type?: string }
): Promise<string> {
  const workspacesRef = collection(db, 'workspaces');
  const newWorkspaceDoc = await addDoc(workspacesRef, {
    name: data.name.trim(),
    description: data.description?.trim() || '',
    type: data.type?.trim() || 'General',
    ownerId: owner.uid,
    ownerName: owner.displayName || 'Owner',
    memberIds: [owner.uid],
    memberCount: 1,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const memberDocRef = doc(db, 'workspaces', newWorkspaceDoc.id, 'members', owner.uid);
  await setDoc(memberDocRef, {
    uid: owner.uid,
    displayName: owner.displayName || 'Owner',
    email: owner.email,
    photoURL: owner.photoURL || null,
    role: 'owner',
    joinedAt: serverTimestamp(),
  });

  await logWorkspaceActivity(
    newWorkspaceDoc.id,
    owner,
    'workspace_created',
    `Created workspace "${data.name.trim()}"`
  );

  return newWorkspaceDoc.id;
}

/**
 * Updates workspace name, description, or type (Admin/Owner only).
 */
export async function updateWorkspaceDetails(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  updates: { name?: string; description?: string; type?: string }
): Promise<void> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
  if (updates.description !== undefined) cleanUpdates.description = updates.description.trim();
  if (updates.type !== undefined) cleanUpdates.type = updates.type.trim();

  await updateDoc(workspaceRef, cleanUpdates);

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'workspace_updated',
    `Updated workspace details`
  );
}

/**
 * Deletes an entire workspace (Owner only).
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  await deleteDoc(workspaceRef);
}

/**
 * Subscribes in real-time to workspace members.
 */
export function subscribeToWorkspaceMembers(
  workspaceId: string,
  onMembersUpdated: (members: WorkspaceMember[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const membersRef = collection(db, 'workspaces', workspaceId, 'members');

  return onSnapshot(
    membersRef,
    (snapshot) => {
      const members: WorkspaceMember[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || 'Member',
          email: data.email || '',
          photoURL: data.photoURL || null,
          role: data.role || 'member',
          joinedAt: data.joinedAt || null,
        } as WorkspaceMember;
      });

      // Sort: owner first, then admins, then members, then alphabetical
      const roleOrder: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 };
      members.sort((a, b) => {
        const diff = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
        if (diff !== 0) return diff;
        return a.displayName.localeCompare(b.displayName);
      });

      onMembersUpdated(members);
    },
    (error) => {
      console.error('Error fetching workspace members:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Changes a member's role (admin, member).
 */
export async function updateMemberRole(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  targetUid: string,
  targetName: string,
  newRole: WorkspaceRole
): Promise<void> {
  const memberDocRef = doc(db, 'workspaces', workspaceId, 'members', targetUid);
  await updateDoc(memberDocRef, { role: newRole });

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'member_role_updated',
    `Changed ${targetName}'s role to ${newRole}`
  );

  // Notify member of their role change
  if (targetUid !== actor.uid) {
    await createNotification(targetUid, {
      type: 'membership_change',
      title: 'Workspace Role Updated',
      message: `Your role was updated to ${newRole} in this workspace.`,
      relatedWorkspaceId: workspaceId,
      link: `/workspaces/${workspaceId}`,
    });
  }
}

/**
 * Removes a member from the workspace or allows a member to leave.
 */
export async function removeMemberFromWorkspace(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  targetUid: string,
  targetName: string,
  isSelfLeave: boolean
): Promise<void> {
  const memberDocRef = doc(db, 'workspaces', workspaceId, 'members', targetUid);
  await deleteDoc(memberDocRef);

  const workspaceRef = doc(db, 'workspaces', workspaceId);
  await updateDoc(workspaceRef, {
    memberIds: arrayRemove(targetUid),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  await logWorkspaceActivity(
    workspaceId,
    actor,
    isSelfLeave ? 'member_left' : 'member_removed',
    isSelfLeave
      ? `${targetName} left the workspace`
      : `${targetName} was removed from the workspace`
  );

  if (!isSelfLeave && targetUid !== actor.uid) {
    await createNotification(targetUid, {
      type: 'membership_change',
      title: 'Removed from Workspace',
      message: `You were removed from the workspace by ${actor.displayName}.`,
      relatedWorkspaceId: workspaceId,
      link: '/workspaces',
    });
  }
}

/**
 * Subscribes in real-time to shared tasks in a workspace.
 */
export function subscribeToWorkspaceTasks(
  workspaceId: string,
  onTasksUpdated: (tasks: SharedTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const tasksRef = collection(db, 'workspaces', workspaceId, 'tasks');

  return onSnapshot(
    tasksRef,
    (snapshot) => {
      const tasks: SharedTask[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId,
          title: data.title || '',
          description: data.description || '',
          priority: data.priority || 'medium',
          dueDate: data.dueDate || '',
          dueTime: data.dueTime || '',
          status: data.status || 'pending',
          category: data.category || 'General',
          assignedToUid: data.assignedToUid || null,
          assignedToName: data.assignedToName || null,
          assignedToEmail: data.assignedToEmail || null,
          createdByUid: data.createdByUid || '',
          createdByName: data.createdByName || 'Member',
          reminderMinutes: data.reminderMinutes ?? null,
          snoozedUntil: data.snoozedUntil ?? null,
          recurrence: data.recurrence || 'none',
          recurrenceEndDate: data.recurrenceEndDate || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        } as SharedTask;
      });

      // Sort by dueDate ascending
      tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

      onTasksUpdated(tasks);
    },
    (error) => {
      console.error('Error fetching workspace shared tasks:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Creates a shared task within a workspace, notifying the assignee.
 */
export async function createSharedTask(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  taskData: {
    title: string;
    description?: string;
    priority: SharedTask['priority'];
    dueDate: string;
    dueTime?: string;
    status: SharedTask['status'];
    category?: string;
    assignedToUid?: string | null;
    assignedToName?: string | null;
    assignedToEmail?: string | null;
    reminderMinutes?: number | null;
    recurrence?: SharedTaskRecurrence;
    recurrenceEndDate?: string | null;
  },
  workspaceName?: string
): Promise<string> {
  const tasksRef = collection(db, 'workspaces', workspaceId, 'tasks');
  const payload: Record<string, unknown> = {
    workspaceId,
    title: taskData.title.trim(),
    description: taskData.description ? taskData.description.trim() : '',
    priority: taskData.priority,
    dueDate: taskData.dueDate,
    dueTime: taskData.dueTime ? taskData.dueTime.trim() : '',
    status: taskData.status,
    category: taskData.category ? taskData.category.trim() : 'General',
    assignedToUid: taskData.assignedToUid || null,
    assignedToName: taskData.assignedToName || null,
    assignedToEmail: taskData.assignedToEmail || null,
    reminderMinutes: taskData.reminderMinutes ?? null,
    snoozedUntil: null,
    recurrence: taskData.recurrence || 'none',
    recurrenceEndDate: taskData.recurrenceEndDate || null,
    createdByUid: actor.uid,
    createdByName: actor.displayName || 'Member',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(tasksRef, payload);

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'task_created',
    `Created shared task "${taskData.title.trim()}"`
  );

  // Send assignment notification to the assigned member
  if (taskData.assignedToUid && taskData.assignedToUid !== actor.uid) {
    await createNotification(taskData.assignedToUid, {
      type: 'task_assignment',
      title: 'New Task Assigned',
      message: `${actor.displayName || 'A team member'} assigned you "${taskData.title.trim()}" in ${workspaceName || 'your workspace'}.`,
      relatedWorkspaceId: workspaceId,
      relatedWorkspaceName: workspaceName,
      relatedTaskId: docRef.id,
      relatedTaskTitle: taskData.title.trim(),
      link: `/workspaces/${workspaceId}?tab=tasks`,
      deterministicKey: `assign_${docRef.id}_${taskData.assignedToUid}`,
    });

    if (taskData.assignedToEmail) {
      await queueTaskAssignmentEmail(
        taskData.assignedToEmail,
        actor.displayName || 'Team Member',
        taskData.title.trim(),
        workspaceName || 'FlowSpace Workspace',
        taskData.dueDate,
        docRef.id
      );
    }
  }

  return docRef.id;
}

/**
 * Updates a shared task in a workspace.
 */
export async function updateSharedTask(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  taskId: string,
  updates: Partial<SharedTask>,
  taskTitle: string,
  previousTask?: SharedTask,
  workspaceName?: string
): Promise<void> {
  const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', taskId);

  // Clean updates: avoid passing undefined values to Firestore
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  Object.entries(updates).forEach(([key, val]) => {
    if (val !== undefined) {
      cleanUpdates[key] = val;
    }
  });

  await updateDoc(taskRef, cleanUpdates);

  const isStatusChange = Boolean(updates.status && updates.status !== previousTask?.status);
  const isAssigneeChange = Boolean(
    updates.assignedToUid !== undefined &&
    updates.assignedToUid !== previousTask?.assignedToUid
  );

  let actionType: WorkspaceActionType = 'task_updated';
  let details = `Updated shared task "${taskTitle}"`;

  if (isAssigneeChange) {
    actionType = 'task_reassigned';
    details = updates.assignedToName
      ? `Reassigned "${taskTitle}" to ${updates.assignedToName}`
      : `Unassigned task "${taskTitle}"`;
  } else if (isStatusChange) {
    actionType = 'task_status_changed';
    details = `Updated "${taskTitle}" status to ${updates.status}`;
  }

  await logWorkspaceActivity(workspaceId, actor, actionType, details);

  // If reassigned, notify the new assignee
  if (
    isAssigneeChange &&
    updates.assignedToUid &&
    updates.assignedToUid !== actor.uid
  ) {
    await createNotification(updates.assignedToUid, {
      type: 'task_reassignment',
      title: 'Task Reassigned to You',
      message: `${actor.displayName || 'A team member'} assigned you "${taskTitle}" in ${workspaceName || 'your workspace'}.`,
      relatedWorkspaceId: workspaceId,
      relatedWorkspaceName: workspaceName,
      relatedTaskId: taskId,
      relatedTaskTitle: taskTitle,
      link: `/workspaces/${workspaceId}?tab=tasks`,
    });

    if (updates.assignedToEmail) {
      await queueTaskAssignmentEmail(
        updates.assignedToEmail,
        actor.displayName || 'Team Member',
        taskTitle,
        workspaceName || 'FlowSpace Workspace',
        updates.dueDate || previousTask?.dueDate || 'Upcoming',
        taskId
      );
    }
  }

  // If status changed to completed, notify creator & assignee
  if (isStatusChange && updates.status === 'completed') {
    const notifyTarget = previousTask?.createdByUid;
    if (notifyTarget && notifyTarget !== actor.uid) {
      await createNotification(notifyTarget, {
        type: 'task_completed',
        title: 'Shared Task Completed',
        message: `${actor.displayName || 'A team member'} marked "${taskTitle}" as completed.`,
        relatedWorkspaceId: workspaceId,
        relatedWorkspaceName: workspaceName,
        relatedTaskId: taskId,
        relatedTaskTitle: taskTitle,
        link: `/workspaces/${workspaceId}?tab=tasks`,
      });
    }

    // Handle shared task recurrence
    const recurrence = updates.recurrence || previousTask?.recurrence;
    const dueDate = updates.dueDate || previousTask?.dueDate;
    if (recurrence && recurrence !== 'none' && dueDate) {
      const nextDate = calculateNextSharedDueDate(dueDate, recurrence);
      const recurrenceEndDate = updates.recurrenceEndDate || previousTask?.recurrenceEndDate;

      if (!recurrenceEndDate || nextDate <= recurrenceEndDate) {
        await createSharedTask(
          workspaceId,
          actor,
          {
            title: taskTitle,
            description: updates.description ?? previousTask?.description,
            priority: updates.priority || previousTask?.priority || 'medium',
            dueDate: nextDate,
            dueTime: updates.dueTime ?? previousTask?.dueTime,
            status: 'pending',
            category: updates.category || previousTask?.category,
            assignedToUid: updates.assignedToUid ?? previousTask?.assignedToUid,
            assignedToName: updates.assignedToName ?? previousTask?.assignedToName,
            assignedToEmail: updates.assignedToEmail ?? previousTask?.assignedToEmail,
            reminderMinutes: updates.reminderMinutes ?? previousTask?.reminderMinutes,
            recurrence,
            recurrenceEndDate,
          },
          workspaceName
        );
      }
    }
  }
}

/**
 * Snoozes a shared task reminder.
 */
export async function snoozeSharedTaskReminder(
  workspaceId: string,
  taskId: string,
  minutesToAdd: number
): Promise<void> {
  const snoozeDate = new Date(Date.now() + minutesToAdd * 60 * 1000);
  const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', taskId);
  await updateDoc(taskRef, {
    snoozedUntil: snoozeDate.toISOString(),
  });
}

/**
 * Deletes a shared task in a workspace.
 */
export async function deleteSharedTask(
  workspaceId: string,
  actor: { uid: string; displayName: string },
  taskId: string,
  taskTitle: string
): Promise<void> {
  const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', taskId);
  await deleteDoc(taskRef);

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'task_deleted',
    `Deleted shared task "${taskTitle}"`
  );
}

/**
 * Subscribes to recent activity events in a workspace.
 */
export function subscribeToWorkspaceActivity(
  workspaceId: string,
  onActivityUpdated: (activities: WorkspaceActivity[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const activityRef = collection(db, 'workspaces', workspaceId, 'activity');
  const q = query(activityRef, orderBy('timestamp', 'desc'), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const activities: WorkspaceActivity[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId,
          actorId: data.actorId || '',
          actorName: data.actorName || 'Member',
          action: data.action || 'workspace_updated',
          details: data.details || '',
          timestamp: data.timestamp || null,
        } as WorkspaceActivity;
      });
      onActivityUpdated(activities);
    },
    (error) => {
      console.error('Error fetching workspace activity:', error);
      if (onError) onError(error);
    }
  );
}
