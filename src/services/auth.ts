import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserProfile } from './userService';

/**
 * Maps Firebase Auth error codes into human-readable, actionable error messages.
 */
export function mapAuthError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Access is temporarily restricted. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.';
      default:
        if ('message' in error && typeof error.message === 'string') {
          return error.message;
        }
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Registers a new user with email and password, updates Auth profile,
 * and initializes their Firestore user record.
 */
export async function registerWithEmail(
  displayName: string,
  email: string,
  pass: string
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // Update display name in Firebase Auth
  await updateProfile(user, {
    displayName: displayName.trim(),
  });

  // Create initial user document in Firestore (Task 7 & 8)
  try {
    await createUserProfile(user.uid, {
      displayName: displayName.trim(),
      email: user.email || email,
      photoURL: user.photoURL,
    });
  } catch (firestoreError) {
    console.error('Failed to create Firestore user profile:', firestoreError);
    // Profile creation failure shouldn't crash auth state, but logs actionable error
  }

  return user;
}

/**
 * Signs in an existing user with email and password.
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
}

/**
 * Signs out the current authenticated user.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sends a password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

