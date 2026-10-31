import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateJoinCode, joinWorkspaceWithInvitation } from '../../services/invitationService';
import { checkJoinCodeRateLimit, clearJoinCodeAttempts } from '../../services/rateLimiter';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import {
  KeyRound,
  Users,
  Briefcase,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export interface JoinWithCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (workspaceId: string, workspaceName: string) => void;
}

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

export const JoinWithCodeModal: React.FC<JoinWithCodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode('');
      setPreview(null);
      setError(null);
      setAlreadyMember(false);
      const limit = checkJoinCodeRateLimit();
      if (!limit.allowed) {
        setRateLimitSeconds(limit.remainingSeconds);
      }
    }
  }, [isOpen]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(raw);
    setError(null);
    if (preview) {
      setPreview(null);
      setAlreadyMember(false);
    }
  };

  const handleValidate = async () => {
    if (code.length !== 6) {
      setError('Please enter a full 6-digit numeric join code.');
      return;
    }

    const limit = checkJoinCodeRateLimit();
    if (!limit.allowed) {
      setRateLimitSeconds(limit.remainingSeconds);
      setError(`Too many failed attempts. Please wait ${limit.remainingSeconds} seconds.`);
      return;
    }

    try {
      setValidating(true);
      setError(null);
      const res = await validateJoinCode(code);
      setPreview(res);
      setAlreadyMember(false);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Invalid join code.';
      setError(msg);
      setPreview(null);
      const limitAfter = checkJoinCodeRateLimit();
      if (!limitAfter.allowed) {
        setRateLimitSeconds(limitAfter.remainingSeconds);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleJoin = async () => {
    if (!preview || !currentUser) return;

    try {
      setJoining(true);
      setError(null);

      await joinWorkspaceWithInvitation(
        { type: 'code', tokenOrCode: code },
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Member',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || null,
        }
      );

      clearJoinCodeAttempts();

      if (onSuccess) {
        onSuccess(preview.workspaceId, preview.workspaceName);
      } else {
        navigate(`/workspaces/${preview.workspaceId}`);
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to join workspace.';
      if (msg.includes('already a member')) {
        setAlreadyMember(true);
      }
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  const isRateLimited = rateLimitSeconds > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join Workspace with Code"
      description="Enter the 6-digit code shared by your workspace administrator"
      maxWidth="md"
    >
      <div className="space-y-5">
        {error && (
          <Alert
            type={alreadyMember ? 'info' : 'error'}
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {isRateLimited && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span>
              Too many incorrect code attempts. Cooldown active for{' '}
              <strong className="font-mono text-amber-950 font-bold">{rateLimitSeconds}s</strong>.
            </span>
          </div>
        )}

        {/* Input Block */}
        {!preview && (
          <div className="space-y-4">
            <div className="text-center">
              <label
                htmlFor="workspace-6digit-code"
                className="block text-xs font-semibold text-[#172033] mb-2 tracking-wide"
              >
                6-Digit Join Code
              </label>

              <div className="relative max-w-xs mx-auto">
                <input
                  id="workspace-6digit-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.length === 6 && !isRateLimited) {
                      e.preventDefault();
                      handleValidate();
                    }
                  }}
                  disabled={isRateLimited || validating}
                  placeholder="000000"
                  autoFocus
                  className="w-full text-center text-3xl font-mono font-bold tracking-[0.45em] py-3.5 px-4 bg-white text-[#172033] border-2 border-[#E7EAF0] rounded-2xl focus:border-[#635BFF] focus:outline-hidden focus:ring-4 focus:ring-[#635BFF]/10 transition-all placeholder:text-slate-300"
                />
              </div>

              <p className="text-[11px] text-[#64748B] mt-2">
                Ask your team lead or workspace admin for their 6-digit join code.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7EAF0]">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleValidate}
                disabled={code.length !== 6 || isRateLimited || validating}
                loading={validating}
                icon={<KeyRound className="w-4 h-4" />}
              >
                Find Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Preview Card */}
        {preview && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-[#F0EAFE]/40 border border-[#E7EAF0] shadow-xs">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <Briefcase className="w-5 h-5" />
                </div>
                <Badge variant="indigo" size="sm">
                  Active Code
                </Badge>
              </div>

              <h3 className="text-base font-extrabold text-[#172033] tracking-tight mb-1">
                {preview.workspaceName}
              </h3>
              {preview.workspaceDescription && (
                <p className="text-xs text-[#64748B] mb-3 leading-relaxed">
                  {preview.workspaceDescription}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E7EAF0]/80 text-xs">
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>
                    Invited by <strong className="text-[#172033]">{preview.inviterName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <Users className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>
                    <strong className="text-[#172033]">{preview.memberCount}</strong> current members
                  </span>
                </div>
              </div>

              {preview.maxUses && (
                <p className="text-[11px] text-[#64748B] mt-2">
                  Uses remaining: {Math.max(0, preview.maxUses - preview.usedCount)} of {preview.maxUses}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#E7EAF0]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreview(null);
                  setCode('');
                  setError(null);
                  setAlreadyMember(false);
                }}
              >
                Try Another Code
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="md" onClick={onClose}>
                  Cancel
                </Button>

                {alreadyMember ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => {
                      navigate(`/workspaces/${preview.workspaceId}`);
                      onClose();
                    }}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Open Workspace
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleJoin}
                    loading={joining}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Join as Member
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
