/**
 * Rate Limiter for 6-Digit Join Code verification attempts.
 * Prevents brute-force search attacks against the 6-digit numeric namespace.
 */

const RATE_LIMIT_KEY = 'flowspace_join_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes lockout
const WINDOW_MS = 5 * 60 * 1000;  // 5 minutes window

interface RateLimitData {
  attempts: number[];
  lockedUntil?: number;
}

function getStoredData(): RateLimitData {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { attempts: [] };
    const parsed = JSON.parse(raw) as RateLimitData;
    return parsed;
  } catch {
    return { attempts: [] };
  }
}

function saveStoredData(data: RateLimitData): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

/**
 * Checks if the user is currently locked out from entering join codes.
 * Returns { allowed: boolean, remainingSeconds: number }
 */
export function checkJoinCodeRateLimit(): { allowed: boolean; remainingSeconds: number } {
  const data = getStoredData();
  const now = Date.now();

  // If locked out
  if (data.lockedUntil && data.lockedUntil > now) {
    const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // Filter out attempts older than the window
  const recentAttempts = data.attempts.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS;
    saveStoredData({ attempts: recentAttempts, lockedUntil });
    return { allowed: false, remainingSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Records a failed join code attempt.
 * If attempts exceed threshold, initiates a lockout period.
 */
export function recordFailedJoinCodeAttempt(): { locked: boolean; remainingSeconds: number } {
  const data = getStoredData();
  const now = Date.now();

  const recentAttempts = data.attempts
    .filter((timestamp) => now - timestamp < WINDOW_MS)
    .concat(now);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS;
    saveStoredData({ attempts: recentAttempts, lockedUntil });
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  saveStoredData({ attempts: recentAttempts });
  return { locked: false, remainingSeconds: 0 };
}

/**
 * Clears failed attempts upon a successful validation or join.
 */
export function clearJoinCodeAttempts(): void {
  try {
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {
    // ignore
  }
}

