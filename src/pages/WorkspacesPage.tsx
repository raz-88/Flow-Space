import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserWorkspaces,
  createWorkspace,
} from '../services/workspaceService';
import {
  subscribeToReceivedInvitations,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
} from '../services/invitationService';
import type { Workspace, WorkspaceInvitation } from '../types/workspace';
import { WorkspaceCard } from '../components/workspaces/WorkspaceCard';
import { CreateWorkspaceModal } from '../components/workspaces/CreateWorkspaceModal';
import { JoinWithCodeModal } from '../components/workspaces/JoinWithCodeModal';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import {
  Plus,
  Mail,
  Check,
  X,
  Briefcase,
  Search,
  KeyRound,
} from 'lucide-react';

export const WorkspacesPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 1. Subscribe to User Workspaces
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoadingWorkspaces(true);
    const unsubscribe = subscribeToUserWorkspaces(
      currentUser.uid,
      (list) => {
        setWorkspaces(list);
        setLoadingWorkspaces(false);
      },
      (err) => {
        console.error(err);
        setFeedback({ type: 'error', message: 'Failed to load team workspaces.' });
        setLoadingWorkspaces(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 2. Subscribe to Received Pending Invitations
  useEffect(() => {
    if (!currentUser?.email) return;

    const unsubscribe = subscribeToReceivedInvitations(
      currentUser.email,
      (list) => {
        setInvitations(list);
      },
      (err) => console.error(err)
    );

    return () => unsubscribe();
  }, [currentUser?.email]);

  // Handlers
  const handleCreateWorkspace = async (data: {
    name: string;
    description?: string;
    type?: string;
  }) => {
    if (!currentUser) return;
    try {
      await createWorkspace(
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Owner',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL,
        },
        data
      );
      setFeedback({ type: 'success', message: `Workspace "${data.name}" created successfully!` });
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create workspace.',
      });
    }
  };

  const handleAcceptInvitation = async (invitation: WorkspaceInvitation) => {
    if (!currentUser) return;
    try {
      setActionLoadingId(invitation.id);
      await acceptWorkspaceInvitation(invitation, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Member',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL,
      });
      setFeedback({
        type: 'success',
        message: `Joined "${invitation.workspaceName}" successfully!`,
      });
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not accept invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvitation = async (invitation: WorkspaceInvitation) => {
    if (!currentUser?.email) return;
    try {
      setActionLoadingId(invitation.id);
      await declineWorkspaceInvitation(invitation.id, currentUser.email);
      setFeedback({
        type: 'success',
        message: `Declined invitation to "${invitation.workspaceName}".`,
      });
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not decline invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter workspaces
  const filteredWorkspaces = workspaces.filter((ws) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ws.name.toLowerCase().includes(q) ||
      (ws.description || '').toLowerCase().includes(q) ||
      (ws.type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7EAF0] mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight">Team Workspaces</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20">
              Collaboration
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            Collaborate on shared tasks, coordinate sprints, and manage workspace membership
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsJoinModalOpen(true)}
            icon={<KeyRound className="w-4 h-4 text-[#635BFF]" />}
          >
            Join with Code
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Workspace
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {feedback && (
        <div className="mb-6">
          <Alert
            type={feedback.type}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        </div>
      )}

      {/* PENDING INVITATIONS BANNER */}
      {invitations.length > 0 && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-[#F0EAFE] to-[#F5F0FF] border border-[#E0D4FC] shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-white/80 text-[#635BFF] shadow-2xs">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-[#172033]">
              Pending Workspace Invitations ({invitations.length})
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mb-4">
            You have been invited to collaborate in the following workspaces:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl bg-white border border-[#E7EAF0] shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-xs font-bold text-[#172033]">{inv.workspaceName}</h3>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Invited by <span className="font-semibold text-[#172033]">{inv.inviterName}</span> as{' '}
                    <span className="capitalize font-semibold text-[#635BFF]">{inv.role}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAcceptInvitation(inv)}
                    loading={actionLoadingId === inv.id}
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeclineInvitation(inv)}
                    disabled={actionLoadingId === inv.id}
                    icon={<X className="w-3.5 h-3.5 text-[#64748B]" />}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH AND CONTROLS */}
      {workspaces.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-[#172033] text-xs placeholder:text-[#64748B] border border-[#E7EAF0] rounded-xl pl-9 pr-3.5 py-2.5 focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 hover:border-slate-300 transition-all shadow-xs"
            />
          </div>

          <span className="text-xs text-[#64748B] font-medium whitespace-nowrap">
            {filteredWorkspaces.length} of {workspaces.length} workspaces
          </span>
        </div>
      )}

      {/* WORKSPACES GRID */}
      {loadingWorkspaces ? (
        <div className="py-16 text-center text-[#64748B] space-y-2">
          <div className="w-6 h-6 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono">Loading team workspaces...</p>
        </div>
      ) : filteredWorkspaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkspaces.map((ws) => {
            const role = ws.ownerId === currentUser?.uid ? 'owner' : 'member';
            return <WorkspaceCard key={ws.id} workspace={ws} currentUserRole={role} />;
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white">
          <div className="w-12 h-12 rounded-2xl bg-[#F0EAFE] text-[#635BFF] flex items-center justify-center mx-auto mb-3 border border-[#635BFF]/20">
            {searchQuery ? <Search className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
          </div>
          <h2 className="text-base font-bold text-[#172033] mb-1">
            {searchQuery ? 'No matching workspaces found' : 'No team workspaces yet'}
          </h2>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? 'Try searching with a different keyword or workspace name.'
              : 'Create a shared workspace to invite teammates, distribute tasks, and track team progress together.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsJoinModalOpen(true)}
              icon={<KeyRound className="w-4 h-4 text-[#635BFF]" />}
            >
              Join with Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Create Your First Workspace
            </Button>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateWorkspace}
      />

      {/* Join Workspace with Code Modal */}
      <JoinWithCodeModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={(_wsId, wsName) => {
          setFeedback({
            type: 'success',
            message: `Successfully joined "${wsName}"!`,
          });
        }}
      />
    </div>
  );
};
