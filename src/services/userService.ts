import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { UserProfile } from '../types/user';

/**
 * Creates a basic user profile document in Firestore using the user's UID as document ID.
 * Follows security requirements:
 * - Document ID is strictly request user's UID
 * - Includes: uid, displayName, email, createdAt, updatedAt
 * - No super admin or client-side elevated privileges are set
 */
export async function createUserProfile(
  uid: string,
  data: { displayName: string; email: string; photoURL?: string | null }
): Promise<void> {
  const userDocRef = doc(db, 'users', uid);

  const profileData: Record<string, unknown> = {
    uid,
    displayName: data.displayName.trim() || 'FlowSpace Member',
    email: data.email.toLowerCase().trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (data.photoURL) {
    profileData.photoURL = data.photoURL;
  }

  await setDoc(userDocRef, profileData);
}

/**
 * Fetches the user profile document by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as UserProfile;
}

/**
 * Updates basic editable fields for the user profile.
 */
export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string }
): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Privacy-aware user lookup by exact registered email.
 * Used for safe team invitations without exposing the entire user directory.
 */
export async function findUserByEmail(
  email: string
): Promise<{ uid: string; displayName: string; email: string; photoURL?: string | null } | null> {
  const cleanEmail = email.toLowerCase().trim();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', cleanEmail), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const userDoc = snap.docs[0];
  const data = userDoc.data();
  return {
    uid: userDoc.id,
    displayName: data.displayName || 'Member',
    email: data.email,
    photoURL: data.photoURL || null,
  };
}
