import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import type { Workspace, WorkspaceInvitation } from '../../types/workspace';
import { findUserByEmail } from '../../services/userService';
import {
  sendWorkspaceInvitation,
  generateShareableInviteLink,
  generate6DigitJoinCode,
  revokeWorkspaceInvitation,
  type ExpiryOption,
} from '../../services/invitationService';
import {
  Mail,
  Shield,
  User,
  Link2,
  KeyRound,
  Copy,
  Check,
  RotateCw,
  Trash2,
  Clock,
  Users,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  currentUser: { uid: string; displayName: string };
  onInviteEmail?: (email: string, role: 'admin' | 'member') => Promise<void>;
  workspaceName?: string;
  onSuccess?: (message: string) => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  workspace,
  currentUser,
  onInviteEmail,
  workspaceName: propWorkspaceName,
  onSuccess,
}) => {
  const workspaceName = workspace?.name || propWorkspaceName || 'Workspace';

  // Active Tab: 'email' | 'link' | 'code'
  const [activeTab, setActiveTab] = useState<'email' | 'link' | 'code'>('email');

  // Tab 1: Email State
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [emailLoading, setEmailLoading] = useState(false);
  const [targetUserPreview, setTargetUserPreview] = useState<{
    uid: string;
    displayName: string;
    email: string;
  } | null>(null);
  const [userCheckStatus, setUserCheckStatus] = useState<
    'idle' | 'checking' | 'found' | 'notFound' | 'isSelf' | 'alreadyMember'
  >('idle');

  // Tab 2 & 3: Link & Code Generation State
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('24h');
  const [maxUsesOption, setMaxUsesOption] = useState<number | null>(5);
  const [actionLoading, setActionLoading] = useState(false);

  // Active Link & Code cached
  const [activeLinkInvite, setActiveLinkInvite] = useState<WorkspaceInvitation | null>(null);
  const [activeCodeInvite, setActiveCodeInvite] = useState<WorkspaceInvitation | null>(null);
  const [loadingActiveInvites, setLoadingActiveInvites] = useState(false);

  // Feedback & Copy State
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load existing active link and code for this workspace
  const fetchActiveInvites = async () => {
    if (!workspace?.id) return;
    try {
      setLoadingActiveInvites(true);
      const q = query(
        collection(db, 'invitations'),
        where('workspaceId', '==', workspace.id),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      let foundLink: WorkspaceInvitation | null = null;
      let foundCode: WorkspaceInvitation | null = null;

      snap.forEach((d) => {
        const data = d.data();
        const inv = { id: d.id, ...data } as WorkspaceInvitation;
        if (inv.type === 'link' || d.id.startsWith('link_')) {
          if (!foundLink) foundLink = inv;
        } else if (inv.type === 'code' || d.id.startsWith('code_')) {
          if (!foundCode) foundCode = inv;
        }
      });

      setActiveLinkInvite(foundLink);
      setActiveCodeInvite(foundCode);
    } catch (err) {
      console.error('Error loading active invites:', err);
    } finally {
      setLoadingActiveInvites(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspace?.id) {
      setError(null);
      fetchActiveInvites();
    }
  }, [isOpen, workspace?.id]);

  // Live email check
  useEffect(() => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setUserCheckStatus('idle');
      setTargetUserPreview(null);
      return;
    }

    if (clean === currentUser?.uid || (workspace?.memberIds && currentUser?.uid && clean === currentUser.displayName)) {
      // ignore
    }

    const timer = setTimeout(async () => {
      try {
        setUserCheckStatus('checking');
        const user = await findUserByEmail(clean);
        if (!user) {
          setUserCheckStatus('notFound');
          setTargetUserPreview(null);
        } else if (user.uid === currentUser?.uid) {
          setUserCheckStatus('isSelf');
          setTargetUserPreview(user);
        } else if (workspace?.memberIds?.includes(user.uid)) {
          setUserCheckStatus('alreadyMember');
          setTargetUserPreview(user);
        } else {
          setUserCheckStatus('found');
          setTargetUserPreview(user);
        }
      } catch {
        setUserCheckStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email, currentUser?.uid, workspace?.memberIds]);

  // Tab 1 Submit: Send Email Invite
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide an email address.');
      return;
    }

    if (userCheckStatus === 'alreadyMember') {
      setError('This user is already a member of this workspace.');
      return;
    }
    if (userCheckStatus === 'isSelf') {
      setError('You cannot invite yourself to your own workspace.');
      return;
    }

    try {
      setEmailLoading(true);
      if (onInviteEmail) {
        await onInviteEmail(email.trim(), role);
      } else {
        await sendWorkspaceInvitation(
          { id: workspace.id, name: workspace.name, memberIds: workspace.memberIds || [] },
          currentUser,
          email.trim(),
          role
        );
      }
      onSuccess?.(`Invitation sent to ${email.trim()}!`);
      setEmail('');
      setTargetUserPreview(null);
      setUserCheckStatus('idle');
      setRole('member');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Tab 2: Generate Shareable Link
  const handleGenerateLink = async () => {
    if (!workspace?.id || !currentUser) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await generateShareableInviteLink(
        { id: workspace.id, name: workspace.name },
        currentUser,
        expiryOption,
        maxUsesOption
      );
      await fetchActiveInvites();
      onSuccess?.('Shareable invite link generated successfully!');
      // auto copy
      navigator.clipboard.writeText(res.inviteUrl).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to generate invitation link.');
    } finally {
      setActionLoading(false);
    }
  };

  // Tab 2: Revoke Shareable Link
  const handleRevokeLink = async (inviteId: string) => {
    if (!workspace?.id || !currentUser) return;
    try {
      setActionLoading(true);
      setError(null);
      await revokeWorkspaceInvitation(inviteId, workspace.id, currentUser, 'Shareable invite link');
      await fetchActiveInvites();
      onSuccess?.('Shareable invite link revoked.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invite link.');
    } finally {
      setActionLoading(false);
    }
  };

  // Tab 3: Generate 6-Digit Code
  const handleGenerateCode = async () => {
    if (!workspace?.id || !currentUser) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await generate6DigitJoinCode(
        { id: workspace.id, name: workspace.name },
        currentUser,
        expiryOption,
        maxUsesOption
      );
      await fetchActiveInvites();
      onSuccess?.(`6-Digit Join Code ${res.code} generated successfully!`);
      navigator.clipboard.writeText(res.code).catch(() => {});
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to generate join code.');
    } finally {
      setActionLoading(false);
    }
  };

  // Tab 3: Revoke 6-Digit Code
  const handleRevokeCode = async (inviteId: string) => {
    if (!workspace?.id || !currentUser) return;
    try {
      setActionLoading(true);
      setError(null);
      await revokeWorkspaceInvitation(inviteId, workspace.id, currentUser, '6-Digit Join Code');
      await fetchActiveInvites();
      onSuccess?.('Join code revoked.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to revoke join code.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const formatExpiryTime = (expiresAt: unknown) => {
    if (!expiresAt) return 'Never';
    if (expiresAt instanceof Timestamp) {
      return expiresAt.toDate().toLocaleString();
    }
    if (typeof expiresAt === 'object' && expiresAt !== null && 'toDate' in expiresAt) {
      return (expiresAt as Timestamp).toDate().toLocaleString();
    }
    return new Date(expiresAt as string).toLocaleString();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite to Workspace"
      description={`Share access to ${workspaceName}`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} />
        )}

        {/* 3 Option Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F8FAFC] rounded-2xl border border-[#E7EAF0]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('email');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'bg-white text-[#635BFF] shadow-xs border border-[#E7EAF0]'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invite Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white text-[#635BFF] shadow-xs border border-[#E7EAF0]'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Shareable Link</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('code');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'bg-white text-[#635BFF] shadow-xs border border-[#E7EAF0]'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>6-Digit Code</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: INVITE BY EMAIL */}
        {/* ============================================================== */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <Input
                label="Registered User Email"
                type="email"
                required
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                autoFocus
              />

              {/* Live User Lookup Status Indicator */}
              <div className="mt-1.5 text-xs">
                {userCheckStatus === 'checking' && (
                  <p className="text-[#64748B] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin" />
                    Checking user registry...
                  </p>
                )}

                {userCheckStatus === 'found' && targetUserPreview && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-emerald-950 text-xs">
                          {targetUserPreview.displayName}
                        </p>
                        <p className="text-[11px] text-emerald-700">{targetUserPreview.email}</p>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      Verified Member
                    </Badge>
                  </div>
                )}

                {userCheckStatus === 'notFound' && (
                  <p className="text-amber-700 flex items-center gap-1.5 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    No registered account found for this email. They must register before being invited.
                  </p>
                )}

                {userCheckStatus === 'alreadyMember' && (
                  <p className="text-amber-700 flex items-center gap-1.5 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {targetUserPreview?.displayName} is already a member of this workspace.
                  </p>
                )}

                {userCheckStatus === 'isSelf' && (
                  <p className="text-amber-700 flex items-center gap-1.5 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    You cannot invite yourself to your own workspace.
                  </p>
                )}

                {userCheckStatus === 'idle' && (
                  <p className="text-[11px] text-[#64748B]">
                    Teammates must be registered with FlowSpace before being invited.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-[#172033] tracking-wide">
                Workspace Role
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setRole('member')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    role === 'member'
                      ? 'bg-[#F0EAFE] border-[#635BFF] ring-2 ring-[#635BFF]/15 shadow-xs'
                      : 'bg-white border-[#E7EAF0] hover:border-slate-300 hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[#172033] mb-1">
                    <User className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>Member</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-snug">
                    Can view and collaborate on shared tasks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    role === 'admin'
                      ? 'bg-[#F0EAFE] border-[#635BFF] ring-2 ring-[#635BFF]/15 shadow-xs'
                      : 'bg-white border-[#E7EAF0] hover:border-slate-300 hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[#172033] mb-1">
                    <Shield className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>Admin</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-snug">
                    Can manage shared tasks and invite new members.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E7EAF0]">
              <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={emailLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={emailLoading}
                disabled={userCheckStatus === 'alreadyMember' || userCheckStatus === 'isSelf'}
              >
                Send Invitation
              </Button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SHAREABLE INVITATION LINK */}
        {/* ============================================================== */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            {loadingActiveInvites ? (
              <div className="py-8 text-center text-[#64748B] text-xs">
                <div className="w-5 h-5 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Checking active invitation links...
              </div>
            ) : activeLinkInvite ? (
              /* Active Link Display Card */
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#F0EAFE] text-[#635BFF]">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172033]">Active Shareable Link</h4>
                      <p className="text-[11px] text-[#64748B]">
                        Anyone with this link can join as a member
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/join-workspace?token=${activeLinkInvite.token || activeLinkInvite.id.replace('link_', '')}`}
                    className="flex-1 bg-[#F8FAFC] text-slate-800 text-xs font-mono border border-[#E7EAF0] rounded-xl px-3 py-2.5 select-all focus:outline-hidden"
                  />
                  <Button
                    type="button"
                    variant={copiedLink ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/join-workspace?token=${activeLinkInvite.token || activeLinkInvite.id.replace('link_', '')}`,
                        true
                      )
                    }
                    icon={copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E7EAF0] text-xs text-[#64748B]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>Expires: {formatExpiryTime(activeLinkInvite.expiresAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>
                      Usage:{' '}
                      <strong className="text-[#172033]">
                        {activeLinkInvite.usedCount || 0}
                      </strong>{' '}
                      / {activeLinkInvite.maxUses ? activeLinkInvite.maxUses : 'Unlimited'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E7EAF0]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                    onClick={() => handleRevokeLink(activeLinkInvite.id)}
                    loading={actionLoading}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Revoke Link
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateLink}
                    loading={actionLoading}
                    icon={<RotateCw className="w-3.5 h-3.5" />}
                  >
                    Generate New Link
                  </Button>
                </div>
              </div>
            ) : (
              /* Configuration to Generate New Link */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F0EAFE]/40 border border-[#635BFF]/15 text-xs text-[#172033]">
                  <p className="font-semibold mb-0.5">Shareable workspace invite link</p>
                  <p className="text-[#64748B] text-[11px] leading-relaxed">
                    Generate a link that can be shared via WhatsApp, Telegram, or email. Invited users
                    will automatically join with the standard <span className="font-semibold text-[#635BFF]">Member</span> role.
                  </p>
                </div>

                {/* Expiry Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[#172033]">
                    Link Expiration Time
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['1h', '24h', '7d'] as ExpiryOption[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setExpiryOption(opt)}
                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                          expiryOption === opt
                            ? 'bg-[#F0EAFE] border-[#635BFF] text-[#635BFF] shadow-xs'
                            : 'bg-white border-[#E7EAF0] text-[#64748B] hover:border-slate-300'
                        }`}
                      >
                        {opt === '1h' ? '1 Hour' : opt === '24h' ? '24 Hours (Default)' : '7 Days'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Uses Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[#172033]">
                    Maximum Uses
                  </label>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[1, 5, 10, null].map((count) => (
                      <button
                        key={count ?? 'unlimited'}
                        type="button"
                        onClick={() => setMaxUsesOption(count)}
                        className={`py-2 px-2.5 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                          maxUsesOption === count
                            ? 'bg-[#F0EAFE] border-[#635BFF] text-[#635BFF] shadow-xs'
                            : 'bg-white border-[#E7EAF0] text-[#64748B] hover:border-slate-300'
                        }`}
                      >
                        {count ? `${count} Uses` : 'Unlimited'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E7EAF0]">
                  <Button type="button" variant="ghost" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleGenerateLink}
                    loading={actionLoading}
                    icon={<Link2 className="w-4 h-4" />}
                  >
                    Generate Shareable Link
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 6-DIGIT JOIN CODE */}
        {/* ============================================================== */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            {loadingActiveInvites ? (
              <div className="py-8 text-center text-[#64748B] text-xs">
                <div className="w-5 h-5 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Checking active join codes...
              </div>
            ) : activeCodeInvite ? (
              /* Active Code Display Card */
              <div className="p-5 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#F0EAFE] text-[#635BFF]">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172033]">Active 6-Digit Join Code</h4>
                      <p className="text-[11px] text-[#64748B]">
                        Members enter this on Workspaces page or /join
                      </p>
                    </div>
                  </div>
                  <Badge variant="indigo" size="sm">
                    Active Code
                  </Badge>
                </div>

                {/* Bold, Spaced Code Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F0EAFE] to-[#F8FAFC] border border-[#635BFF]/20 text-center relative group">
                  <span className="text-3xl sm:text-4xl font-mono font-extrabold text-[#635BFF] tracking-[0.45em] select-all">
                    {activeCodeInvite.code || activeCodeInvite.id.replace('code_', '')}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant={copiedCode ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        activeCodeInvite.code || activeCodeInvite.id.replace('code_', ''),
                        false
                      )
                    }
                    icon={copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedCode ? 'Code Copied!' : 'Copy 6-Digit Code'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E7EAF0] text-xs text-[#64748B]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>Expires: {formatExpiryTime(activeCodeInvite.expiresAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>
                      Usage:{' '}
                      <strong className="text-[#172033]">
                        {activeCodeInvite.usedCount || 0}
                      </strong>{' '}
                      / {activeCodeInvite.maxUses ? activeCodeInvite.maxUses : 'Unlimited'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E7EAF0]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                    onClick={() => handleRevokeCode(activeCodeInvite.id)}
                    loading={actionLoading}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Revoke Code
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateCode}
                    loading={actionLoading}
                    icon={<RotateCw className="w-3.5 h-3.5" />}
                  >
                    Regenerate Code
                  </Button>
                </div>
              </div>
            ) : (
              /* Configuration to Generate New Code */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F0EAFE]/40 border border-[#635BFF]/15 text-xs text-[#172033]">
                  <p className="font-semibold mb-0.5">Quick 6-Digit Join Code</p>
                  <p className="text-[#64748B] text-[11px] leading-relaxed">
                    Generate an easy 6-digit numeric passcode. Teammates can enter it on the Workspaces
                    page to instantly request access and join.
                  </p>
                </div>

                {/* Expiry Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[#172033]">
                    Code Expiration Time
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['1h', '24h', '7d'] as ExpiryOption[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setExpiryOption(opt)}
                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                          expiryOption === opt
                            ? 'bg-[#F0EAFE] border-[#635BFF] text-[#635BFF] shadow-xs'
                            : 'bg-white border-[#E7EAF0] text-[#64748B] hover:border-slate-300'
                        }`}
                      >
                        {opt === '1h' ? '1 Hour' : opt === '24h' ? '24 Hours (Default)' : '7 Days'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Uses Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[#172033]">
                    Maximum Uses
                  </label>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[1, 5, 10, null].map((count) => (
                      <button
                        key={count ?? 'unlimited'}
                        type="button"
                        onClick={() => setMaxUsesOption(count)}
                        className={`py-2 px-2.5 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                          maxUsesOption === count
                            ? 'bg-[#F0EAFE] border-[#635BFF] text-[#635BFF] shadow-xs'
                            : 'bg-white border-[#E7EAF0] text-[#64748B] hover:border-slate-300'
                        }`}
                      >
                        {count ? `${count} Uses` : 'Unlimited'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E7EAF0]">
                  <Button type="button" variant="ghost" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleGenerateCode}
                    loading={actionLoading}
                    icon={<KeyRound className="w-4 h-4" />}
                  >
                    Generate 6-Digit Code
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
