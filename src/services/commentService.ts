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
import type { TaskComment } from '../types/workspace';
import { logWorkspaceActivity } from './workspaceService';
import { createNotification } from './notificationService';

/**
 * Subscribes in real-time to comments for a specific shared task.
 */
export function subscribeToTaskComments(
  workspaceId: string,
  taskId: string,
  onCommentsUpdated: (comments: TaskComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const commentsRef = collection(
    db,
    'workspaces',
    workspaceId,
    'tasks',
    taskId,
    'comments'
  );
  const q = query(commentsRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const comments: TaskComment[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId,
          taskId,
          authorUid: data.authorUid || '',
          authorName: data.authorName || 'Member',
          authorEmail: data.authorEmail || '',
          content: data.content || '',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });
      onCommentsUpdated(comments);
    },
    (error) => {
      console.error('Error listening to task comments:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Adds a new comment to a shared task and notifies relevant collaborators.
 */
export async function addTaskComment(
  workspaceId: string,
  taskId: string,
  taskTitle: string,
  workspaceName: string,
  author: { uid: string; displayName: string; email?: string },
  content: string,
  collaboratorUids?: { assignedToUid?: string | null; createdByUid?: string }
): Promise<string> {
  const commentsRef = collection(
    db,
    'workspaces',
    workspaceId,
    'tasks',
    taskId,
    'comments'
  );

  const docRef = await addDoc(commentsRef, {
    workspaceId,
    taskId,
    authorUid: author.uid,
    authorName: author.displayName || 'Member',
    authorEmail: author.email || '',
    content: content.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Log activity in the workspace
  await logWorkspaceActivity(
    workspaceId,
    author,
    'comment_added',
    `Commented on task "${taskTitle}"`
  );

  // Notify assignee if not the author
  if (
    collaboratorUids?.assignedToUid &&
    collaboratorUids.assignedToUid !== author.uid
  ) {
    await createNotification(collaboratorUids.assignedToUid, {
      type: 'task_comment',
      title: 'New Comment on Your Task',
      message: `${author.displayName || 'A team member'} commented on "${taskTitle}": "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
      relatedWorkspaceId: workspaceId,
      relatedWorkspaceName: workspaceName,
      relatedTaskId: taskId,
      relatedTaskTitle: taskTitle,
      link: `/workspaces/${workspaceId}?tab=tasks`,
    });
  }

  // Notify creator if not author and not already assignee
  if (
    collaboratorUids?.createdByUid &&
    collaboratorUids.createdByUid !== author.uid &&
    collaboratorUids.createdByUid !== collaboratorUids?.assignedToUid
  ) {
    await createNotification(collaboratorUids.createdByUid, {
      type: 'task_comment',
      title: 'New Comment on Created Task',
      message: `${author.displayName || 'A team member'} commented on "${taskTitle}": "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
      relatedWorkspaceId: workspaceId,
      relatedWorkspaceName: workspaceName,
      relatedTaskId: taskId,
      relatedTaskTitle: taskTitle,
      link: `/workspaces/${workspaceId}?tab=tasks`,
    });
  }

  return docRef.id;
}

/**
 * Updates an existing comment (author only).
 */
export async function updateTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  newContent: string
): Promise<void> {
  const commentRef = doc(
    db,
    'workspaces',
    workspaceId,
    'tasks',
    taskId,
    'comments',
    commentId
  );

  await updateDoc(commentRef, {
    content: newContent.trim(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a comment (author or workspace admin/owner).
 */
export async function deleteTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  taskTitle: string,
  actor: { uid: string; displayName: string }
): Promise<void> {
  const commentRef = doc(
    db,
    'workspaces',
    workspaceId,
    'tasks',
    taskId,
    'comments',
    commentId
  );

  await deleteDoc(commentRef);

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'comment_deleted',
    `Removed a comment from task "${taskTitle}"`
  );
}

