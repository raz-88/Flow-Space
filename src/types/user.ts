import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;
  photoURL?: string | null;
}

export interface AuthErrorState {
  code: string;
  message: string;
}

