import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  validateInvitationToken,
  validateJoinCode,
  joinWorkspaceWithInvitation,
} from '../services/invitationService';
import { checkJoinCodeRateLimit } from '../services/rateLimiter';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import {
  Users,
  Briefcase,
  Sparkles,
  LogIn,
  UserPlus,
  KeyRound,
  Clock,
  ChevronLeft,
} from 'lucide-react';

interface WorkspacePreview {
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
}

export const JoinWorkspacePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const codeParam = searchParams.get('code');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: if query param exists, auto-validating; otherwise manual code entry
  const [manualCode, setManualCode] = useState(codeParam || '');
  const [validating, setValidating] = useState(Boolean(tokenParam || codeParam));
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Active invitation identifier being joined
  const [activeIdentifier, setActiveIdentifier] = useState<{
    type: 'link' | 'code';
    tokenOrCode: string;
  } | null>(null);

  // Auto-validate on query params change
  useEffect(() => {
    if (tokenParam) {
      validateToken(tokenParam);
    } else if (codeParam) {
      validateCode(codeParam);
    } else {
      setValidating(false);
      setPreview(null);
      setError(null);
    }
  }, [tokenParam, codeParam]);

  const validateToken = async (token: string) => {
    try {
      setValidating(true);
      setError(null);
      const res = await validateInvitationToken(token);
      setPreview(res);
      setActiveIdentifier({ type: 'link', tokenOrCode: token });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to validate invitation link.');
      setPreview(null);
    } finally {
      setValidating(false);
    }
  };

  const validateCode = async (code: string) => {
    // Check rate limit first
    const limitCheck = checkJoinCodeRateLimit();
    if (!limitCheck.allowed) {
      setRateLimitSeconds(limitCheck.remainingSeconds);
      setError(`Too many failed attempts. Cooldown active for ${limitCheck.remainingSeconds} seconds.`);
      return;
    }

    try {
      setValidating(true);
      setError(null);
      const res = await validateJoinCode(code);
      setPreview(res);
      setActiveIdentifier({ type: 'code', tokenOrCode: code });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Invalid or expired join code.');
      setPreview(null);
    } finally {
      setValidating(false);
    }
  };

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setError('Please enter a 6-digit join code.');
      return;
    }
    validateCode(manualCode.trim());
  };

  const handleJoin = async () => {
    if (!activeIdentifier || !currentUser) return;

    try {
      setJoining(true);
      setError(null);
      const result = await joinWorkspaceWithInvitation(activeIdentifier, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Member',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL,
      });

      // Navigate to workspace with positive state
      navigate(`/workspaces/${result.workspaceId}`, {
        state: { message: `Welcome! You have joined "${result.workspaceName}".` },
        replace: true,
      });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to join workspace.');
    } finally {
      setJoining(false);
    }
  };

  // Compute login/register redirect URL
  const currentRedirect = encodeURIComponent(location.pathname + location.search);

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-12 bg-[#F8FAFC]">
      <div className="w-full max-w-lg">
        {/* Top Breadcrumb / Return */}
        <div className="mb-6">
          <Link
            to="/workspaces"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#172033] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Workspaces</span>
          </Link>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        {/* STATE 1: LOADING VALIDATION */}
        {validating && (
          <Card className="p-8 text-center space-y-4">
            <div className="w-8 h-8 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-sm font-bold text-[#172033]">Verifying Workspace Invitation...</h3>
            <p className="text-xs text-[#64748B]">Checking cryptographic link and invitation status</p>
          </Card>
        )}

        {/* STATE 2: MANUAL 6-DIGIT CODE ENTRY (No preview yet and not currently validating) */}
        {!validating && !preview && (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F0EAFE] to-[#E8F0FF] text-[#635BFF] flex items-center justify-center mx-auto shadow-2xs border border-[#635BFF]/20">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-[#172033] tracking-tight">
                Join with 6-Digit Code
              </h2>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
                Enter the six-digit invitation code provided by your team workspace administrator.
              </p>
            </div>

            <form onSubmit={handleManualCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-2 text-center">
                  6-Digit Join Code
                </label>
                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={manualCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setManualCode(val);
                      setError(null);
                    }}
                    placeholder="000000"
                    disabled={rateLimitSeconds > 0}
                    className="w-48 text-center font-mono text-2xl font-bold tracking-[0.4em] py-3 px-4 rounded-xl border border-[#E7EAF0] bg-[#F8FAFC] focus:bg-white focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/15 transition-all outline-hidden text-[#172033]"
                    autoFocus
                  />
                </div>
                {rateLimitSeconds > 0 && (
                  <p className="text-[11px] text-rose-600 text-center mt-2 font-medium">
                    Please wait {rateLimitSeconds}s before attempting again.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center"
                disabled={manualCode.length !== 6 || rateLimitSeconds > 0}
              >
                Find Workspace
              </Button>
            </form>

            <div className="pt-4 border-t border-[#E7EAF0] text-center">
              <p className="text-[11px] text-[#64748B]">
                Have a shareable invitation link instead? Paste it into your browser to join directly.
              </p>
            </div>
          </Card>
        )}

        {/* STATE 3: PREVIEW & JOIN WORKSPACE */}
        {!validating && preview && (
          <Card className="p-6 sm:p-8 space-y-6 overflow-hidden relative">
            {/* Subtle top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#635BFF] to-[#8B5CF6]" />

            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] text-white flex items-center justify-center mx-auto shadow-md">
                <Briefcase className="w-7 h-7" />
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Badge variant="indigo" size="sm">
                  Workspace Invitation
                </Badge>
                <Badge variant="mint" size="sm">
                  Verified
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold text-[#172033] tracking-tight">
                {preview.workspaceName}
              </h2>
              {preview.workspaceDescription ? (
                <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                  {preview.workspaceDescription}
                </p>
              ) : (
                <p className="text-xs text-[#64748B]">Collaborative team workspace</p>
              )}
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0] space-y-2.5 text-xs text-[#64748B]">
              <div className="flex items-center justify-between">
                <span>Invited by</span>
                <span className="font-semibold text-[#172033]">{preview.inviterName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Team Members</span>
                <span className="font-semibold text-[#172033] flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>{preview.memberCount} active</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Your Role</span>
                <span className="font-semibold text-[#635BFF] bg-[#F0EAFE] px-2 py-0.5 rounded-md border border-[#635BFF]/20">
                  Standard Member
                </span>
              </div>

              {preview.expiresAt && (
                <div className="flex items-center justify-between pt-1 border-t border-[#E7EAF0]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Valid until</span>
                  </span>
                  <span className="font-medium text-[#172033]">
                    {preview.expiresAt.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {preview.maxUses && preview.maxUses > 0 && (
                <div className="flex items-center justify-between">
                  <span>Spots Remaining</span>
                  <span className="font-semibold text-emerald-700">
                    {Math.max(0, preview.maxUses - preview.usedCount)} of {preview.maxUses} spots
                  </span>
                </div>
              )}
            </div>

            {/* ACTION SECTION */}
            {!currentUser ? (
              /* Case A: User Not Logged In */
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[#FFF0E5] border border-amber-200 text-xs text-amber-900 leading-relaxed text-center">
                  <p className="font-semibold mb-0.5">Authentication Required</p>
                  <p>Please log in or create an account. You will automatically return here to join.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Link to={`/login?redirect=${currentRedirect}`}>
                    <Button variant="primary" size="md" className="w-full justify-center" icon={<LogIn className="w-4 h-4" />}>
                      Sign In
                    </Button>
                  </Link>
                  <Link to={`/register?redirect=${currentRedirect}`}>
                    <Button variant="secondary" size="md" className="w-full justify-center" icon={<UserPlus className="w-4 h-4" />}>
                      Register
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Case B: User Logged In */
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleJoin}
                  loading={joining}
                  className="w-full justify-center text-sm font-bold shadow-md"
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Join Workspace
                </Button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      setActiveIdentifier(null);
                      navigate('/join-workspace', { replace: true });
                    }}
                    className="text-xs text-[#64748B] hover:text-[#172033] transition-colors cursor-pointer"
                  >
                    Enter a different code
                  </button>
                  <Link
                    to="/workspaces"
                    className="text-xs font-semibold text-[#635BFF] hover:text-[#5145E5] transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
