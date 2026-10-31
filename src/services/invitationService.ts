import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  increment,
  Timestamp,
  runTransaction,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { WorkspaceInvitation } from '../types/workspace';
import { findUserByEmail } from './userService';
import { logWorkspaceActivity } from './workspaceService';
import { createNotification } from './notificationService';
import {
  checkJoinCodeRateLimit,
  recordFailedJoinCodeAttempt,
  clearJoinCodeAttempts,
} from './rateLimiter';

export type ExpiryOption = '1h' | '24h' | '7d';

export function calculateExpiryDate(option: ExpiryOption): Date {
  const now = Date.now();
  if (option === '1h') return new Date(now + 60 * 60 * 1000);
  if (option === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000); // 24h default
}

function generateSecureToken(length = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

function generateSecure6DigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const num = array[0] % 1000000;
  return num.toString().padStart(6, '0');
}

/**
 * Sends a workspace invitation to an existing registered FlowSpace user.
 * Enforces:
 * 1. Recipient must be registered in FlowSpace users collection.
 * 2. Recipient cannot be the inviter.
 * 3. Recipient cannot already be in workspace.memberIds.
 * 4. Deterministic document ID (${workspaceId}_${targetUser.uid}) prevents duplicate pending invites.
 */
export async function sendWorkspaceInvitation(
  workspace: { id: string; name: string; memberIds: string[] },
  inviter: { uid: string; displayName: string },
  recipientEmail: string,
  role: 'admin' | 'member' = 'member'
): Promise<string> {
  const cleanEmail = recipientEmail.toLowerCase().trim();

  // 1. Look up user by email
  const targetUser = await findUserByEmail(cleanEmail);
  if (!targetUser) {
    throw new Error(
      `No registered FlowSpace account was found for ${cleanEmail}. Please ask them to create an account first.`
    );
  }

  // 2. Prevent self-invite
  if (targetUser.uid === inviter.uid) {
    throw new Error('You cannot invite yourself to your own workspace.');
  }

  // 3. Prevent duplicate membership
  if (workspace.memberIds.includes(targetUser.uid)) {
    throw new Error(`${targetUser.displayName} is already a member of this workspace.`);
  }

  // 4. Check for active pending invitation using deterministic ID
  const inviteId = `${workspace.id}_${targetUser.uid}`;
  const inviteDocRef = doc(db, 'invitations', inviteId);
  const existingSnap = await getDoc(inviteDocRef);

  if (existingSnap.exists() && existingSnap.data()?.status === 'pending') {
    throw new Error(`A pending invitation has already been sent to ${cleanEmail}.`);
  }

  await setDoc(inviteDocRef, {
    type: 'email',
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    inviterUid: inviter.uid,
    inviterName: inviter.displayName || 'Member',
    recipientEmail: cleanEmail,
    recipientUid: targetUser.uid,
    role,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logWorkspaceActivity(
    workspace.id,
    inviter,
    'member_invited',
    `Invited ${targetUser.displayName} (${cleanEmail}) as ${role}`
  );

  return inviteId;
}

/**
 * Generates a unique, cryptographically secure shareable invitation link.
 */
export async function generateShareableInviteLink(
  workspace: { id: string; name: string },
  inviter: { uid: string; displayName: string },
  expiryOption: ExpiryOption = '24h',
  maxUses: number | null = 5
): Promise<{ token: string; inviteId: string; inviteUrl: string }> {
  const token = generateSecureToken(28);
  const inviteId = `link_${token}`;
  const inviteDocRef = doc(db, 'invitations', inviteId);
  const expiryDate = calculateExpiryDate(expiryOption);

  await setDoc(inviteDocRef, {
    type: 'link',
    token,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    inviterUid: inviter.uid,
    inviterName: inviter.displayName || 'Member',
    role: 'member',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiryDate),
    maxUses: maxUses && maxUses > 0 ? maxUses : null,
    usedCount: 0,
    usedBy: [],
  });

  await logWorkspaceActivity(
    workspace.id,
    inviter,
    'invitation_link_generated',
    `Generated shareable invite link (${expiryOption} expiry, ${maxUses ? `${maxUses} max uses` : 'unlimited uses'})`
  );

  const inviteUrl = `${window.location.origin}/join-workspace?token=${token}`;
  return { token, inviteId, inviteUrl };
}

/**
 * Generates a unique 6-digit numeric join code.
 * Ensures the code is random and unique among active codes in Firestore.
 */
export async function generate6DigitJoinCode(
  workspace: { id: string; name: string },
  inviter: { uid: string; displayName: string },
  expiryOption: ExpiryOption = '24h',
  maxUses: number | null = 5
): Promise<{ code: string; inviteId: string }> {
  let code = generateSecure6DigitCode();
  let inviteId = `code_${code}`;
  let docRef = doc(db, 'invitations', inviteId);
  let snap = await getDoc(docRef);

  // If collision with active code, regenerate (extremely low probability, but safe)
  let tries = 0;
  while (snap.exists() && snap.data()?.status === 'active' && tries < 5) {
    code = generateSecure6DigitCode();
    inviteId = `code_${code}`;
    docRef = doc(db, 'invitations', inviteId);
    snap = await getDoc(docRef);
    tries++;
  }

  const expiryDate = calculateExpiryDate(expiryOption);

  await setDoc(docRef, {
    type: 'code',
    code,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    inviterUid: inviter.uid,
    inviterName: inviter.displayName || 'Member',
    role: 'member',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiryDate),
    maxUses: maxUses && maxUses > 0 ? maxUses : null,
    usedCount: 0,
    usedBy: [],
  });

  await logWorkspaceActivity(
    workspace.id,
    inviter,
    'join_code_generated',
    `Generated 6-digit join code (${expiryOption} expiry, ${maxUses ? `${maxUses} max uses` : 'unlimited uses'})`
  );

  return { code, inviteId };
}

/**
 * Validates a shareable invitation token and retrieves workspace preview details.
 */
export async function validateInvitationToken(token: string): Promise<{
  inviteId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceDescription?: string;
  inviterName: string;
  memberCount: number;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  status: string;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Invitation token is missing or malformed.');
  }

  const inviteDocRef = doc(db, 'invitations', `link_${cleanToken}`);
  const snap = await getDoc(inviteDocRef);

  if (!snap.exists()) {
    throw new Error('This invitation link is invalid or does not exist.');
  }

  const data = snap.data();
  if (data.status !== 'active') {
    if (data.status === 'revoked') {
      throw new Error('This invitation link has been revoked by workspace administrators.');
    }
    if (data.status === 'expired') {
      throw new Error('This invitation link has reached its maximum usage limit or expired.');
    }
    throw new Error('This invitation link is no longer active.');
  }

  // Check expiration timestamp
  const expiresAtMillis = data.expiresAt?.toMillis?.() || (data.expiresAt ? new Date(data.expiresAt).getTime() : 0);
  if (expiresAtMillis && expiresAtMillis < Date.now()) {
    // Optionally mark expired in Firestore
    await updateDoc(inviteDocRef, { status: 'expired', updatedAt: serverTimestamp() }).catch(() => {});
    throw new Error('This invitation link has expired. Please ask for a new invitation.');
  }

  // Check usage limit
  if (data.maxUses && data.maxUses > 0 && (data.usedCount || 0) >= data.maxUses) {
    await updateDoc(inviteDocRef, { status: 'expired', updatedAt: serverTimestamp() }).catch(() => {});
    throw new Error('This invitation link has reached its maximum number of uses.');
  }

  // Fetch workspace details for preview
  const wsSnap = await getDoc(doc(db, 'workspaces', data.workspaceId));
  const wsData = wsSnap.exists() ? wsSnap.data() : null;

  return {
    inviteId: snap.id,
    workspaceId: data.workspaceId,
    workspaceName: wsData?.name || data.workspaceName || 'Team Workspace',
    workspaceDescription: wsData?.description || '',
    inviterName: data.inviterName || 'Workspace Admin',
    memberCount: wsData?.memberCount || wsData?.memberIds?.length || 1,
    expiresAt: expiresAtMillis ? new Date(expiresAtMillis) : null,
    maxUses: data.maxUses || null,
    usedCount: data.usedCount || 0,
    status: data.status,
  };
}

/**
 * Validates a 6-digit numeric join code with rate limiting protection.
 */
export async function validateJoinCode(code: string): Promise<{
  inviteId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceDescription?: string;
  inviterName: string;
  memberCount: number;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  status: string;
}> {
  const cleanCode = code.trim();

  // 1. Check rate limit
  const rateLimit = checkJoinCodeRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(
      `Too many incorrect code attempts. Please wait ${rateLimit.remainingSeconds} seconds before trying again.`
    );
  }

  // 2. Validate format: exactly 6 digits
  if (!/^\d{6}$/.test(cleanCode)) {
    recordFailedJoinCodeAttempt();
    throw new Error('Join code must be exactly 6 numeric digits (e.g. 048291).');
  }

  // 3. Query document by ID
  const inviteDocRef = doc(db, 'invitations', `code_${cleanCode}`);
  const snap = await getDoc(inviteDocRef);

  if (!snap.exists()) {
    const lockInfo = recordFailedJoinCodeAttempt();
    if (lockInfo.locked) {
      throw new Error(
        `Too many failed attempts. Temporary lockout for ${lockInfo.remainingSeconds} seconds.`
      );
    }
    throw new Error('Invalid or expired join code. Please verify the 6 digits and try again.');
  }

  const data = snap.data();
  if (data.status !== 'active') {
    recordFailedJoinCodeAttempt();
    if (data.status === 'revoked') {
      throw new Error('This join code has been revoked by workspace administrators.');
    }
    throw new Error('This join code has expired or is no longer active.');
  }

  // Check expiration timestamp
  const expiresAtMillis = data.expiresAt?.toMillis?.() || (data.expiresAt ? new Date(data.expiresAt).getTime() : 0);
  if (expiresAtMillis && expiresAtMillis < Date.now()) {
    await updateDoc(inviteDocRef, { status: 'expired', updatedAt: serverTimestamp() }).catch(() => {});
    throw new Error('This join code has expired. Please ask for a new code.');
  }

  // Check usage limit
  if (data.maxUses && data.maxUses > 0 && (data.usedCount || 0) >= data.maxUses) {
    await updateDoc(inviteDocRef, { status: 'expired', updatedAt: serverTimestamp() }).catch(() => {});
    throw new Error('This join code has reached its maximum number of uses.');
  }

  // Successful validation clears rate limit strikes
  clearJoinCodeAttempts();

  // Fetch workspace details for preview
  const wsSnap = await getDoc(doc(db, 'workspaces', data.workspaceId));
  const wsData = wsSnap.exists() ? wsSnap.data() : null;

  return {
    inviteId: snap.id,
    workspaceId: data.workspaceId,
    workspaceName: wsData?.name || data.workspaceName || 'Team Workspace',
    workspaceDescription: wsData?.description || '',
    inviterName: data.inviterName || 'Workspace Admin',
    memberCount: wsData?.memberCount || wsData?.memberIds?.length || 1,
    expiresAt: expiresAtMillis ? new Date(expiresAtMillis) : null,
    maxUses: data.maxUses || null,
    usedCount: data.usedCount || 0,
    status: data.status,
  };
}

/**
 * Atomically joins an authenticated user to a workspace using a link token or 6-digit code.
 * Enforces:
 * 1. Invitation must be active, unexpired, and below usage limit.
 * 2. User cannot already be a member of the workspace.
 * 3. User cannot have already consumed this invitation.
 * 4. Adds user strictly with role 'member' (never admin or owner).
 * 5. Atomically increments workspace.memberCount, updates memberIds.
 * 6. Atomically increments invitation.usedCount and registers user in usedBy.
 * 7. Logs immutable workspace activity record.
 * 8. Notifies workspace owner.
 */
export async function joinWorkspaceWithInvitation(
  inviteIdentifier: { type: 'link' | 'code'; tokenOrCode: string },
  currentUser: { uid: string; displayName: string; email: string; photoURL?: string | null }
): Promise<{ workspaceId: string; workspaceName: string }> {
  const cleanKey = inviteIdentifier.tokenOrCode.trim();
  const inviteDocId = inviteIdentifier.type === 'link' ? `link_${cleanKey}` : `code_${cleanKey}`;
  const inviteRef = doc(db, 'invitations', inviteDocId);

  let targetWorkspaceId = '';
  let targetWorkspaceName = '';
  let targetOwnerId = '';

  await runTransaction(db, async (transaction) => {
    // 1. Read invitation
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('The invitation could not be found or has been removed.');
    }

    const inviteData = inviteSnap.data();
    if (inviteData.status !== 'active') {
      throw new Error(`This invitation is no longer active (status: ${inviteData.status}).`);
    }

    const expiresAtMillis = inviteData.expiresAt?.toMillis?.() || 0;
    if (expiresAtMillis && expiresAtMillis < Date.now()) {
      throw new Error('This invitation has expired.');
    }

    const usedCount = inviteData.usedCount || 0;
    if (inviteData.maxUses && inviteData.maxUses > 0 && usedCount >= inviteData.maxUses) {
      throw new Error('This invitation has reached its maximum usage limit.');
    }

    const usedBy: string[] = inviteData.usedBy || [];
    if (usedBy.includes(currentUser.uid)) {
      throw new Error('You have already used this invitation.');
    }

    // 2. Read workspace
    targetWorkspaceId = inviteData.workspaceId;
    const workspaceRef = doc(db, 'workspaces', targetWorkspaceId);
    const workspaceSnap = await transaction.get(workspaceRef);

    if (!workspaceSnap.exists()) {
      throw new Error('The workspace associated with this invitation does not exist.');
    }

    const wsData = workspaceSnap.data();
    targetWorkspaceName = wsData.name || 'Workspace';
    targetOwnerId = wsData.ownerId || '';

    // Check duplicate membership
    const memberIds: string[] = wsData.memberIds || [];
    if (memberIds.includes(currentUser.uid)) {
      throw new Error(`You are already a member of "${targetWorkspaceName}".`);
    }

    // 3. Create member document in workspaces/{workspaceId}/members/{user.uid}
    const memberRef = doc(db, 'workspaces', targetWorkspaceId, 'members', currentUser.uid);
    transaction.set(memberRef, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Member',
      email: currentUser.email,
      photoURL: currentUser.photoURL || null,
      role: 'member', // Strictly member
      joinedAt: serverTimestamp(),
      inviteId: inviteSnap.id,
    });

    // 4. Update workspace memberIds array and memberCount
    transaction.update(workspaceRef, {
      memberIds: arrayUnion(currentUser.uid),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // 5. Update invitation consumption
    const newUsedCount = usedCount + 1;
    const isExhausted = Boolean(inviteData.maxUses && inviteData.maxUses > 0 && newUsedCount >= inviteData.maxUses);

    transaction.update(inviteRef, {
      usedCount: increment(1),
      usedBy: arrayUnion(currentUser.uid),
      status: isExhausted ? 'expired' : 'active',
      updatedAt: serverTimestamp(),
    });
  });

  // Post-transaction activity & notifications
  try {
    await logWorkspaceActivity(
      targetWorkspaceId,
      currentUser,
      'invitation_accepted',
      `${currentUser.displayName || 'A new member'} joined the workspace via ${
        inviteIdentifier.type === 'link' ? 'invitation link' : '6-digit join code'
      }`
    );
  } catch (err) {
    console.warn('Could not log workspace activity for member join:', err);
  }

  if (targetOwnerId && targetOwnerId !== currentUser.uid) {
    try {
      await createNotification(targetOwnerId, {
        type: 'workspace_joined',
        title: 'New Member Joined',
        message: `${currentUser.displayName || 'A new member'} joined "${targetWorkspaceName}".`,
        relatedWorkspaceId: targetWorkspaceId,
        relatedWorkspaceName: targetWorkspaceName,
        link: `/workspaces/${targetWorkspaceId}?tab=members`,
      });
    } catch (err) {
      console.warn('Could not notify workspace owner:', err);
    }
  }

  return { workspaceId: targetWorkspaceId, workspaceName: targetWorkspaceName };
}

/**
 * Subscribes to pending invitations received by the current user.
 */
export function subscribeToReceivedInvitations(
  userEmail: string,
  onInvitationsUpdated: (invitations: WorkspaceInvitation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const invitationsRef = collection(db, 'invitations');
  const q = query(
    invitationsRef,
    where('recipientEmail', '==', userEmail.toLowerCase().trim()),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WorkspaceInvitation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || 'email',
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName || 'Workspace',
          inviterUid: data.inviterUid,
          inviterName: data.inviterName || 'A teammate',
          recipientEmail: data.recipientEmail,
          recipientUid: data.recipientUid,
          token: data.token,
          code: data.code,
          role: data.role || 'member',
          status: data.status || 'pending',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          expiresAt: data.expiresAt || null,
          maxUses: data.maxUses,
          usedCount: data.usedCount,
          usedBy: data.usedBy,
        } as WorkspaceInvitation;
      });
      onInvitationsUpdated(list);
    },
    (err) => {
      console.error('Error fetching received invitations:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to pending invitations sent by a workspace.
 */
export function subscribeToWorkspaceSentInvitations(
  workspaceId: string,
  onInvitationsUpdated: (invitations: WorkspaceInvitation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const invitationsRef = collection(db, 'invitations');
  const q = query(
    invitationsRef,
    where('workspaceId', '==', workspaceId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WorkspaceInvitation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || 'email',
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          inviterUid: data.inviterUid,
          inviterName: data.inviterName,
          recipientEmail: data.recipientEmail,
          recipientUid: data.recipientUid,
          token: data.token,
          code: data.code,
          role: data.role || 'member',
          status: data.status || 'pending',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          expiresAt: data.expiresAt || null,
          maxUses: data.maxUses,
          usedCount: data.usedCount,
          usedBy: data.usedBy,
        } as WorkspaceInvitation;
      });
      onInvitationsUpdated(list);
    },
    (err) => {
      console.error('Error fetching sent invitations:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to ALL invitations (email, link, code) created for a workspace.
 */
export function subscribeToAllWorkspaceInvitations(
  workspaceId: string,
  onInvitationsUpdated: (invitations: WorkspaceInvitation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const invitationsRef = collection(db, 'invitations');
  const q = query(
    invitationsRef,
    where('workspaceId', '==', workspaceId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WorkspaceInvitation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || (d.id.startsWith('link_') ? 'link' : d.id.startsWith('code_') ? 'code' : 'email'),
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          inviterUid: data.inviterUid,
          inviterName: data.inviterName,
          recipientEmail: data.recipientEmail,
          recipientUid: data.recipientUid,
          token: data.token,
          code: data.code,
          role: data.role || 'member',
          status: data.status || 'pending',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          expiresAt: data.expiresAt || null,
          maxUses: data.maxUses,
          usedCount: data.usedCount || 0,
          usedBy: data.usedBy || [],
        } as WorkspaceInvitation;
      });
      onInvitationsUpdated(list);
    },
    (err) => {
      console.error('Error fetching workspace invitations:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Accepts an email workspace invitation:
 * 1. Verifies recipient matches authenticated user.
 * 2. Adds user document into workspaces/{workspaceId}/members/{user.uid}.
 * 3. Appends user.uid to workspaces/{workspaceId}.memberIds and increments memberCount.
 * 4. Marks invitation as 'accepted'.
 * 5. Logs workspace activity.
 */
export async function acceptWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  currentUser: { uid: string; displayName: string; email: string; photoURL?: string | null }
): Promise<void> {
  const cleanEmail = currentUser.email.toLowerCase().trim();
  if (invitation.recipientEmail && invitation.recipientEmail.toLowerCase() !== cleanEmail) {
    throw new Error('This invitation was sent to a different account.');
  }

  // Verify invitation document is still pending
  const invitationRef = doc(db, 'invitations', invitation.id);
  const snap = await getDoc(invitationRef);
  if (!snap.exists() || snap.data()?.status !== 'pending') {
    throw new Error('This invitation is no longer valid or has already been accepted/revoked.');
  }

  const workspaceId = invitation.workspaceId;

  // 1. Add to members subcollection
  const memberRef = doc(db, 'workspaces', workspaceId, 'members', currentUser.uid);
  await setDoc(memberRef, {
    uid: currentUser.uid,
    displayName: currentUser.displayName || 'Member',
    email: currentUser.email,
    photoURL: currentUser.photoURL || null,
    role: invitation.role || 'member',
    joinedAt: serverTimestamp(),
    inviteId: invitation.id,
  });

  // 2. Add to workspace memberIds array and increment count
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  await updateDoc(workspaceRef, {
    memberIds: arrayUnion(currentUser.uid),
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  // 3. Mark invitation accepted
  await updateDoc(invitationRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  // 4. Log activity
  await logWorkspaceActivity(
    workspaceId,
    currentUser,
    'invitation_accepted',
    `${currentUser.displayName || 'A new member'} accepted the invitation and joined the workspace`
  );
}

/**
 * Declines a workspace invitation.
 */
export async function declineWorkspaceInvitation(
  invitationId: string,
  userEmail: string
): Promise<void> {
  const invitationRef = doc(db, 'invitations', invitationId);
  const snap = await getDoc(invitationRef);

  if (snap.exists()) {
    const data = snap.data();
    if (data.recipientEmail && data.recipientEmail.toLowerCase() !== userEmail.toLowerCase().trim()) {
      throw new Error('You are not authorized to decline this invitation.');
    }
  }

  await updateDoc(invitationRef, {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Revokes an invitation (email, link, or code) by workspace owner or admin.
 */
export async function revokeWorkspaceInvitation(
  invitationId: string,
  workspaceId: string,
  actor: { uid: string; displayName: string },
  detailsOrRecipient = ''
): Promise<void> {
  const invitationRef = doc(db, 'invitations', invitationId);
  await updateDoc(invitationRef, {
    status: 'revoked',
    updatedAt: serverTimestamp(),
  });

  await logWorkspaceActivity(
    workspaceId,
    actor,
    'invitation_revoked',
    `Revoked invitation (${detailsOrRecipient || invitationId})`
  );
}
