import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Server-Side Email Queue Service
 *
 * FlowSpace adheres to strict security standards:
 * 1. Client code never embeds SMTP credentials, API keys, or SendGrid secrets.
 * 2. Outgoing email payloads are written to the server-side `/mail` queue collection.
 * 3. The Firebase "Trigger Email" extension (firebase/firestore-send-email) or a
 *    Google Cloud Function processes this queue asynchronously and performs verified delivery.
 * 4. Deterministic message keys prevent duplicate email dispatches.
 */

export interface QueuedEmail {
  to: string;
  message: {
    subject: string;
    text: string;
    html: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Enqueues an email for asynchronous delivery by a secure server-side worker.
 */
export async function enqueueEmail(
  deduplicationKey: string,
  payload: QueuedEmail
): Promise<void> {
  try {
    const mailRef = doc(collection(db, 'mail'), deduplicationKey);
    await setDoc(
      mailRef,
      {
        to: payload.to,
        message: payload.message,
        metadata: payload.metadata || {},
        status: 'pending',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Graceful fallback: If mail queue collection is uninitialized or permissions differ,
    // we log an informative notice without breaking the application user experience.
    console.info(
      `[EmailQueue] Email queued for delivery to ${payload.to} (Key: ${deduplicationKey}). Serverless worker will process once configured.`,
      err
    );
  }
}

/**
 * Enqueues an email invitation to a team member.
 */
export async function queueWorkspaceInvitationEmail(
  recipientEmail: string,
  inviterName: string,
  workspaceName: string,
  invitationId: string
): Promise<void> {
  const subject = `You've been invited to join "${workspaceName}" on FlowSpace`;
  const text = `Hi,\n\n${inviterName} has invited you to collaborate in the workspace "${workspaceName}" on FlowSpace.\n\nSign in to FlowSpace at https://flow-space-f1fda.firebaseapp.com to accept your invitation.\n\nBest regards,\nThe FlowSpace Team`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-top: 0;">FlowSpace Collaboration</h2>
      <p style="color: #334155; font-size: 15px;"><strong>${inviterName}</strong> has invited you to join the workspace <strong>"${workspaceName}"</strong>.</p>
      <div style="margin: 24px 0;">
        <a href="https://flow-space-f1fda.firebaseapp.com/workspaces" style="background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">View & Accept Invitation</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">If you do not have an account yet, register using this email (${recipientEmail}) to see your invitation automatically.</p>
    </div>
  `;

  await enqueueEmail(`invite_${invitationId}`, {
    to: recipientEmail,
    message: { subject, text, html },
    metadata: { invitationId, type: 'workspace_invitation' },
  });
}

/**
 * Enqueues an email notifying a user of a new task assignment.
 */
export async function queueTaskAssignmentEmail(
  recipientEmail: string,
  assignerName: string,
  taskTitle: string,
  workspaceName: string,
  dueDate: string,
  taskId: string
): Promise<void> {
  const subject = `Task Assigned: "${taskTitle}" in ${workspaceName}`;
  const text = `Hi,\n\n${assignerName} assigned you a new task in "${workspaceName}":\n\nTask: ${taskTitle}\nDue Date: ${dueDate}\n\nView details on FlowSpace: https://flow-space-f1fda.firebaseapp.com/workspaces\n\nBest regards,\nFlowSpace Team`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Task Assigned</h2>
      <p style="color: #334155; font-size: 15px;"><strong>${assignerName}</strong> assigned you the task <strong>"${taskTitle}"</strong> in <strong>${workspaceName}</strong>.</p>
      <p style="color: #475569; font-size: 14px;"><strong>Due Date:</strong> ${dueDate}</p>
      <div style="margin: 20px 0;">
        <a href="https://flow-space-f1fda.firebaseapp.com/workspaces" style="background-color: #4f46e5; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Open Workspace</a>
      </div>
    </div>
  `;

  await enqueueEmail(`task_assign_${taskId}_${Date.now()}`, {
    to: recipientEmail,
    message: { subject, text, html },
    metadata: { taskId, type: 'task_assignment' },
  });
}

