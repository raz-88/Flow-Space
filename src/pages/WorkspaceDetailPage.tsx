import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToWorkspace,
  subscribeToWorkspaceMembers,
  subscribeToWorkspaceTasks,
  subscribeToWorkspaceActivity,
  updateWorkspaceDetails,
  deleteWorkspace,
  updateMemberRole,
  removeMemberFromWorkspace,
  createSharedTask,
  updateSharedTask,
  deleteSharedTask,
  snoozeSharedTaskReminder,
} from '../services/workspaceService';
import {
  sendWorkspaceInvitation,
  subscribeToAllWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from '../services/invitationService';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  SharedTask,
  SharedTaskPriority,
  SharedTaskStatus,
  WorkspaceActivity,
  WorkspaceInvitation,
} from '../types/workspace';
import { SharedTaskModal, type SharedTaskSubmitData } from '../components/workspaces/SharedTaskModal';
import { TaskCommentsModal } from '../components/workspaces/TaskCommentsModal';
import { InviteMemberModal } from '../components/workspaces/InviteMemberModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import {
  ChevronLeft,
  Users,
  Plus,
  UserPlus,
  LogOut,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Clock3,
  Activity,
  Settings,
  Check,
  Crown,
  Shield,
  User,
  AlertTriangle,
  FolderKanban,
  Edit2,
  X,
  Search,
  MessageSquare,
  Repeat,
  Bell,
  Tag,
  AlertCircle,
  UserCheck,
  Link2,
  KeyRound,
  Copy,
  Mail,
} from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export const WorkspaceDetailPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Workspace Data State
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [sentInvitations, setSentInvitations] = useState<WorkspaceInvitation[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Active Tab: 'tasks' | 'members' | 'activity' | 'settings'
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'activity' | 'settings'>('tasks');

  // Task Filter States
  const [taskScopeFilter, setTaskScopeFilter] = useState<
    'all' | 'assigned_to_me' | 'created_by_me' | 'overdue' | 'completed'
  >('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | SharedTaskStatus>('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | SharedTaskPriority>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<SharedTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<SharedTask | null>(null);
  const [activeCommentTask, setActiveCommentTask] = useState<SharedTask | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] = useState(false);

  // Invitations filter and clipboard state
  const [inviteFilterType, setInviteFilterType] = useState<'all' | 'email' | 'link' | 'code'>('all');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Settings form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('General');
  const [savingSettings, setSavingSettings] = useState(false);

  // 1. Subscribe to Workspace
  useEffect(() => {
    if (!workspaceId) return;

    setLoading(true);
    const unsub = subscribeToWorkspace(
      workspaceId,
      (data) => {
        if (!data) {
          setError('Workspace not found or you do not have permission to access it.');
          setLoading(false);
          return;
        }
        setWorkspace(data);
        setEditName(data.name);
        setEditDesc(data.description || '');
        setEditType(data.type || 'General');
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Permission denied or error loading workspace.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [workspaceId]);

  // 2. Subscribe to Members, Tasks, Activity, Sent Invitations
  useEffect(() => {
    if (!workspaceId || !workspace) return;

    const unsubMembers = subscribeToWorkspaceMembers(workspaceId, setMembers);
    const unsubTasks = subscribeToWorkspaceTasks(workspaceId, setTasks);
    const unsubActivity = subscribeToWorkspaceActivity(workspaceId, setActivities);
    const unsubInvites = subscribeToAllWorkspaceInvitations(workspaceId, setSentInvitations);

    return () => {
      unsubMembers();
      unsubTasks();
      unsubActivity();
      unsubInvites();
    };
  }, [workspaceId, workspace?.id]);

  // Determine current user's role
  const currentUserRole: WorkspaceRole = useMemo(() => {
    if (!currentUser || !workspace) return 'member';
    if (workspace.ownerId === currentUser.uid) return 'owner';
    const member = members.find((m) => m.uid === currentUser.uid);
    return member?.role || 'member';
  }, [currentUser, workspace, members]);

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Distinct categories in workspace tasks
  const workspaceCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [tasks]);

  // Task metrics
  const taskStats = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const assignedToMe = tasks.filter((t) => t.assignedToUid === currentUser?.uid).length;
    const createdByMe = tasks.filter((t) => t.createdByUid === currentUser?.uid).length;
    const overdue = tasks.filter((t) => t.status !== 'completed' && t.dueDate < todayStr).length;

    return {
      total: tasks.length,
      active: pending + inProgress,
      completed,
      assignedToMe,
      createdByMe,
      overdue,
    };
  }, [tasks, currentUser?.uid, todayStr]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Scope Filter Tab
      if (taskScopeFilter === 'assigned_to_me' && t.assignedToUid !== currentUser?.uid) return false;
      if (taskScopeFilter === 'created_by_me' && t.createdByUid !== currentUser?.uid) return false;
      if (taskScopeFilter === 'overdue' && (t.status === 'completed' || t.dueDate >= todayStr)) return false;
      if (taskScopeFilter === 'completed' && t.status !== 'completed') return false;

      // Status dropdown filter
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;

      // Priority dropdown filter
      if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;

      // Category dropdown filter
      if (taskCategoryFilter !== 'all' && t.category !== taskCategoryFilter) return false;

      // Assignee dropdown filter
      if (taskAssigneeFilter !== 'all') {
        if (taskAssigneeFilter === 'unassigned' && t.assignedToUid) return false;
        if (taskAssigneeFilter !== 'unassigned' && t.assignedToUid !== taskAssigneeFilter) return false;
      }

      // Search keyword filter
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const mTitle = t.title.toLowerCase().includes(q);
        const mDesc = (t.description || '').toLowerCase().includes(q);
        const mAssignee = (t.assignedToName || '').toLowerCase().includes(q);
        const mCat = (t.category || '').toLowerCase().includes(q);
        if (!mTitle && !mDesc && !mAssignee && !mCat) return false;
      }
      return true;
    });
  }, [
    tasks,
    taskScopeFilter,
    taskStatusFilter,
    taskPriorityFilter,
    taskCategoryFilter,
    taskAssigneeFilter,
    taskSearch,
    currentUser?.uid,
    todayStr,
  ]);

  // Derived Active Link, Active Code, and Filtered Invitations
  const activeLink = useMemo(() => {
    return sentInvitations.find((inv) => {
      const isLink = inv.type === 'link' || inv.id.startsWith('link_');
      if (!isLink || inv.status !== 'active') return false;
      const expiryTime =
        (inv.expiresAt as Timestamp)?.toMillis?.() ||
        (inv.expiresAt ? new Date(inv.expiresAt as unknown as string).getTime() : null);
      if (expiryTime && expiryTime < Date.now()) return false;
      if (inv.maxUses && (inv.usedCount || 0) >= inv.maxUses) return false;
      return true;
    });
  }, [sentInvitations]);

  const activeCode = useMemo(() => {
    return sentInvitations.find((inv) => {
      const isCode = inv.type === 'code' || inv.id.startsWith('code_');
      if (!isCode || inv.status !== 'active') return false;
      const expiryTime =
        (inv.expiresAt as Timestamp)?.toMillis?.() ||
        (inv.expiresAt ? new Date(inv.expiresAt as unknown as string).getTime() : null);
      if (expiryTime && expiryTime < Date.now()) return false;
      if (inv.maxUses && (inv.usedCount || 0) >= inv.maxUses) return false;
      return true;
    });
  }, [sentInvitations]);

  const filteredInvitations = useMemo(() => {
    return sentInvitations.filter((inv) => {
      if (inviteFilterType === 'all') return true;
      if (inviteFilterType === 'email') {
        return (
          inv.type === 'email' ||
          (!inv.type && !inv.id.startsWith('link_') && !inv.id.startsWith('code_'))
        );
      }
      if (inviteFilterType === 'link') {
        return inv.type === 'link' || inv.id.startsWith('link_');
      }
      if (inviteFilterType === 'code') {
        return inv.type === 'code' || inv.id.startsWith('code_');
      }
      return true;
    });
  }, [sentInvitations, inviteFilterType]);

  const handleCopyInviteText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const formatInviteExpiry = (expiresAt: unknown) => {
    if (!expiresAt) return 'Never';
    if (typeof expiresAt === 'object' && expiresAt !== null && 'toDate' in expiresAt) {
      return (expiresAt as Timestamp).toDate().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return new Date(expiresAt as string).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handlers
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !currentUser || !isAdmin) return;

    try {
      setSavingSettings(true);
      await updateWorkspaceDetails(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Admin' },
        { name: editName.trim(), description: editDesc.trim(), type: editType }
      );
      setFeedback({ type: 'success', message: 'Workspace details updated.' });
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update settings.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId || !isOwner) return;

    try {
      await deleteWorkspace(workspaceId);
      navigate('/workspaces');
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete workspace.',
      });
      setIsDeleteWorkspaceModalOpen(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!workspaceId || !currentUser || isOwner) return;

    try {
      await removeMemberFromWorkspace(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
        currentUser.uid,
        currentUser.displayName || 'Member',
        true
      );
      navigate('/workspaces');
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to leave workspace.',
      });
      setIsLeaveModalOpen(false);
    }
  };

  const handleSendInvitation = async (email: string, role: 'admin' | 'member') => {
    if (!workspace || !currentUser) return;
    await sendWorkspaceInvitation(
      { id: workspace.id, name: workspace.name, memberIds: workspace.memberIds },
      { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
      email,
      role
    );
    setFeedback({ type: 'success', message: `Invitation sent to ${email}!` });
  };

  const handleRevokeInvitation = async (invite: WorkspaceInvitation) => {
    if (!workspaceId || !currentUser || !isAdmin) return;
    try {
      await revokeWorkspaceInvitation(
        invite.id,
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Admin' },
        invite.recipientEmail || invite.code || (invite.type === 'link' ? 'Shareable link' : invite.id)
      );
      setFeedback({ type: 'success', message: 'Invitation revoked successfully.' });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Could not revoke invitation.' });
    }
  };

  const handleUpdateRole = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
    if (!workspaceId || !currentUser || !isAdmin || member.role === 'owner') return;

    try {
      await updateMemberRole(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Admin' },
        member.uid,
        member.displayName,
        newRole
      );
      setFeedback({ type: 'success', message: `Updated ${member.displayName}'s role to ${newRole}.` });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to update member role.' });
    }
  };

  const handleRemoveMember = async () => {
    if (!workspaceId || !currentUser || !isAdmin || !memberToRemove) return;

    try {
      await removeMemberFromWorkspace(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Admin' },
        memberToRemove.uid,
        memberToRemove.displayName,
        false
      );
      setFeedback({ type: 'success', message: `Removed ${memberToRemove.displayName} from workspace.` });
      setMemberToRemove(null);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to remove member.' });
    }
  };

  const handleCreateOrUpdateTask = async (data: SharedTaskSubmitData) => {
    if (!workspaceId || !currentUser) return;

    if (taskToEdit) {
      await updateSharedTask(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
        taskToEdit.id,
        data,
        data.title,
        taskToEdit,
        workspace?.name
      );
      setFeedback({ type: 'success', message: `Updated task "${data.title}".` });
      setTaskToEdit(null);
    } else {
      await createSharedTask(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
        data,
        workspace?.name
      );
      setFeedback({ type: 'success', message: `Created shared task "${data.title}".` });
    }
  };

  const handleUpdateTaskStatus = async (task: SharedTask, newStatus: SharedTaskStatus) => {
    if (!workspaceId || !currentUser) return;
    try {
      await updateSharedTask(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
        task.id,
        { status: newStatus },
        task.title,
        task,
        workspace?.name
      );
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Could not update task status.' });
    }
  };

  const handleToggleTaskStatus = async (task: SharedTask) => {
    const newStatus: SharedTaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    await handleUpdateTaskStatus(task, newStatus);
  };

  const handleSnoozeSharedTask = async (task: SharedTask, minutes: number) => {
    if (!workspaceId) return;
    try {
      await snoozeSharedTaskReminder(workspaceId, task.id, minutes);
      setFeedback({ type: 'success', message: `Snoozed alert for "${task.title}" by ${minutes} minutes.` });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Could not snooze task.' });
    }
  };

  const handleDeleteTask = async () => {
    if (!workspaceId || !currentUser || !taskToDelete) return;
    try {
      await deleteSharedTask(
        workspaceId,
        { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
        taskToDelete.id,
        taskToDelete.title
      );
      setFeedback({ type: 'success', message: `Deleted task "${taskToDelete.title}".` });
      setTaskToDelete(null);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to delete task.' });
    }
  };

  const formatActivityTime = (timestamp: unknown) => {
    if (!timestamp) return 'Just now';
    if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
      return (timestamp as Timestamp).toDate().toLocaleString();
    }
    return 'Recently';
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono">Loading workspace details...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-100">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          {error || 'This workspace does not exist or you have not been granted membership access.'}
        </p>
        <Link to="/workspaces">
          <Button variant="secondary" size="sm" icon={<ChevronLeft className="w-4 h-4" />}>
            Back to All Workspaces
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb Navigation */}
      <div className="mb-4">
        <Link
          to="/workspaces"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Team Workspaces</span>
        </Link>
      </div>

      {/* Main Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E7EAF0] mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight">{workspace.name}</h1>
            <Badge variant="neutral" size="sm">
              {workspace.type || 'General'}
            </Badge>
            <Badge
              variant={isOwner ? 'indigo' : isAdmin ? 'warning' : 'neutral'}
              size="sm"
              className="flex items-center gap-1"
            >
              {isOwner ? (
                <Crown className="w-3 h-3 text-[#635BFF]" />
              ) : isAdmin ? (
                <Shield className="w-3 h-3 text-amber-600" />
              ) : (
                <User className="w-3 h-3 text-[#64748B]" />
              )}
              <span className="capitalize">{currentUserRole}</span>
            </Badge>
          </div>
          <p className="text-xs text-[#64748B] max-w-xl leading-relaxed">
            {workspace.description || 'Collaborative team space for projects, tasks, and discussion.'}
          </p>
          <p className="text-[11px] text-[#64748B] mt-1.5">
            Owner: <span className="font-semibold text-[#172033]">{workspace.ownerName}</span> &bull;{' '}
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Task
          </Button>

          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Invite
            </Button>
          )}

          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeaveModalOpen(true)}
              icon={<LogOut className="w-3.5 h-3.5" />}
            >
              Leave
            </Button>
          )}
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

      {/* Overview Stat Cards with Soft Tinted Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-[#D4E3FC] bg-gradient-to-br from-[#E8F0FF] to-[#F0EAFE] shadow-xs">
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">Members</span>
            <div className="p-1.5 rounded-lg bg-white/80 text-blue-600 shadow-2xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">{members.length}</div>
          <p className="text-[11px] text-blue-800/80 mt-1 font-medium">Active collaborators</p>
        </div>

        <div className="p-5 rounded-2xl border border-[#E0D4FC] bg-gradient-to-br from-[#F0EAFE] to-[#F5F0FF] shadow-xs">
          <div className="flex items-center justify-between text-[#635BFF] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#635BFF]">Active Tasks</span>
            <div className="p-1.5 rounded-lg bg-white/80 text-[#635BFF] shadow-2xs">
              <Clock3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">{taskStats.active}</div>
          <p className="text-[11px] text-[#635BFF]/80 mt-1 font-medium">Pending & In Progress</p>
        </div>

        <div className="p-5 rounded-2xl border border-[#BBF7D0] bg-gradient-to-br from-[#E2F8EE] to-[#F0FDF4] shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Completed</span>
            <div className="p-1.5 rounded-lg bg-white/80 text-emerald-600 shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800">{taskStats.completed}</div>
          <p className="text-[11px] text-emerald-800/80 mt-1 font-medium">Resolved tasks</p>
        </div>

        <div className="p-5 rounded-2xl border border-[#E7EAF0] bg-white shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Activity</span>
            <div className="p-1.5 rounded-lg bg-[#F0EAFE] text-[#635BFF] shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">{activities.length}</div>
          <p className="text-[11px] text-[#64748B] mt-1 font-medium">Recorded events</p>
        </div>
      </div>

      {/* Modern Tab Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#E7EAF0] shadow-xs mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20 shadow-xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Shared Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20 shadow-xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members & Invites ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20 shadow-xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Activity Timeline</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20 shadow-xs'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* TAB 1: SHARED TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Quick Scope Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setTaskScopeFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                taskScopeFilter === 'all'
                  ? 'bg-[#172033] text-white shadow-xs font-semibold'
                  : 'bg-white border border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
              }`}
            >
              All Tasks ({taskStats.total})
            </button>
            <button
              type="button"
              onClick={() => setTaskScopeFilter('assigned_to_me')}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                taskScopeFilter === 'assigned_to_me'
                  ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/30 font-semibold shadow-xs'
                  : 'bg-white border border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assigned to Me ({taskStats.assignedToMe})</span>
            </button>
            <button
              type="button"
              onClick={() => setTaskScopeFilter('created_by_me')}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                taskScopeFilter === 'created_by_me'
                  ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/30 font-semibold shadow-xs'
                  : 'bg-white border border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
              }`}
            >
              Created by Me ({taskStats.createdByMe})
            </button>
            <button
              type="button"
              onClick={() => setTaskScopeFilter('overdue')}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                taskScopeFilter === 'overdue'
                  ? 'bg-[#FFF0E5] text-rose-700 border border-rose-300 font-semibold shadow-xs'
                  : 'bg-white border border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Overdue ({taskStats.overdue})</span>
            </button>
            <button
              type="button"
              onClick={() => setTaskScopeFilter('completed')}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                taskScopeFilter === 'completed'
                  ? 'bg-[#E2F8EE] text-emerald-800 border border-emerald-300 font-semibold shadow-xs'
                  : 'bg-white border border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed ({taskStats.completed})</span>
            </button>
          </div>

          {/* Secondary Controls Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E7EAF0] shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search shared tasks by title, desc, assignee, category..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] text-[#172033] text-xs placeholder:text-[#64748B] border border-[#E7EAF0] rounded-xl pl-9 pr-3.5 py-2 focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              {workspaceCategories.length > 0 && (
                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value)}
                  className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {workspaceCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              {/* Priority Filter */}
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value as 'all' | SharedTaskPriority)}
                className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              {/* Status Filter */}
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value as 'all' | SharedTaskStatus)}
                className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              {/* Assignee Filter */}
              <select
                value={taskAssigneeFilter}
                onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Task List */}
          {filteredTasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredTasks.map((t) => {
                const isCompleted = t.status === 'completed';
                const isOverdue = !isCompleted && t.dueDate < todayStr;
                const isDueToday = !isCompleted && t.dueDate === todayStr;

                return (
                  <div
                    key={t.id}
                    className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all duration-150 shadow-xs flex items-start gap-3.5 ${
                      isCompleted
                        ? 'border-[#E7EAF0] bg-[#F8FAFC]/60 opacity-75'
                        : isOverdue
                        ? 'border-rose-200 hover:border-rose-300 bg-[#FFF0E5]/15'
                        : 'border-[#E7EAF0] hover:border-[#635BFF]/30 hover:shadow-md'
                    }`}
                  >
                    {/* Completion Checkbox */}
                    <button
                      onClick={() => handleToggleTaskStatus(t)}
                      className={`w-5 h-5 rounded-full border mt-0.5 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 hover:border-[#635BFF] hover:bg-[#F0EAFE]'
                      }`}
                      aria-label="Toggle task status"
                    >
                      {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`text-sm font-semibold tracking-tight ${
                              isCompleted ? 'line-through text-[#64748B] font-normal' : 'text-[#172033]'
                            }`}
                          >
                            {t.title}
                          </h4>

                          {/* Overdue Badge */}
                          {isOverdue && (
                            <Badge variant="warning" size="sm" className="bg-[#FFF0E5] text-rose-700 border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </Badge>
                          )}

                          {isDueToday && (
                            <Badge variant="indigo" size="sm">
                              Due Today
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Discussion / Comments Trigger */}
                          <button
                            type="button"
                            onClick={() => setActiveCommentTask(t)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-[#635BFF] bg-[#F0EAFE] hover:bg-[#E8F0FF] transition-colors border border-[#635BFF]/20 flex items-center gap-1.5 cursor-pointer"
                            title="Task Discussion"
                          >
                            <MessageSquare className="w-3 h-3 text-[#635BFF]" />
                            <span>Discussion</span>
                          </button>

                          <button
                            onClick={() => {
                              setTaskToEdit(t);
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1.5 text-[#64748B] hover:text-[#172033] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTaskToDelete(t)}
                            className="p-1.5 text-[#64748B] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {t.description && (
                        <p
                          className={`text-xs mt-1.5 leading-relaxed ${
                            isCompleted ? 'text-[#64748B] line-through' : 'text-[#64748B]'
                          }`}
                        >
                          {t.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#E7EAF0] text-xs">
                        {/* Assignee */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F8FAFC] text-[#172033] font-medium text-[11px] border border-[#E7EAF0]">
                          <User className="w-3 h-3 text-[#635BFF]" />
                          <span>{t.assignedToName || 'Unassigned'}</span>
                        </span>

                        {/* Category Tag */}
                        {t.category && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] font-medium text-[11px] border border-[#E7EAF0]">
                            <Tag className="w-3 h-3 text-[#64748B]" />
                            <span>{t.category}</span>
                          </span>
                        )}

                        {/* Priority */}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold text-[11px] border capitalize ${
                            t.priority === 'high'
                              ? 'bg-[#FFF0E5] text-rose-700 border-rose-200'
                              : t.priority === 'medium'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-[#E7EAF0]'
                          }`}
                        >
                          {t.priority}
                        </span>

                        {/* Recurrence */}
                        {t.recurrence && t.recurrence !== 'none' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0EAFE] text-[#635BFF] font-medium text-[11px] border border-[#635BFF]/20">
                            <Repeat className="w-3 h-3 text-[#635BFF]" />
                            <span className="capitalize">{t.recurrence}</span>
                          </span>
                        )}

                        {/* Reminder */}
                        {t.reminderMinutes !== null && t.reminderMinutes !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium text-[11px] border border-amber-200">
                            <Bell className="w-3 h-3 text-amber-600" />
                            <span>Reminder</span>
                          </span>
                        )}

                        {/* Status Quick Selector */}
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTaskStatus(t, e.target.value as SharedTaskStatus)}
                          className="text-[11px] font-semibold bg-[#F8FAFC] border border-[#E7EAF0] rounded-lg px-2 py-0.5 text-[#172033] hover:border-slate-300 focus:outline-hidden cursor-pointer"
                          title="Quick update status"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>

                        {/* Due Date */}
                        {t.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              isOverdue ? 'text-rose-600 font-semibold' : 'text-[#64748B]'
                            }`}
                          >
                            <Calendar className="w-3 h-3 text-[#64748B]" />
                            <span>{t.dueDate}</span>
                            {t.dueTime && (
                              <span className="flex items-center gap-0.5 ml-1">
                                <Clock className="w-3 h-3 text-[#64748B]" />
                                <span>{t.dueTime}</span>
                              </span>
                            )}
                          </span>
                        )}

                        {/* Snooze if reminder or overdue */}
                        {(isOverdue || (t.reminderMinutes !== null && t.reminderMinutes !== undefined)) && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleSnoozeSharedTask(t, 15)}
                            className="inline-flex items-center gap-1 text-[10px] text-amber-800 hover:text-amber-950 bg-[#FFF0E5] hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition-colors cursor-pointer font-medium"
                            title="Snooze reminder by 15m"
                          >
                            <Clock3 className="w-2.5 h-2.5" />
                            <span>Snooze 15m</span>
                          </button>
                        )}

                        <span className="text-[10px] text-[#64748B] ml-auto">
                          Created by {t.createdByName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EAFE] text-[#635BFF] flex items-center justify-center mx-auto mb-3 border border-[#635BFF]/20">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#172033] mb-1">
                {taskSearch || taskStatusFilter !== 'all' || taskAssigneeFilter !== 'all'
                  ? 'No matching shared tasks found'
                  : 'No shared tasks in this workspace'}
              </h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-5 leading-relaxed">
                {taskSearch
                  ? 'Try adjusting your search keywords or filter settings.'
                  : 'Distribute work across teammates, set deadlines, and track collaborative progress.'}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Shared Task
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MEMBERS & INVITATIONS */}
      {activeTab === 'members' && (
        <div className="space-y-8">
          {/* Active Members Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#172033]">Active Workspace Members</h3>
                <p className="text-xs text-[#64748B]">
                  Collaborators with direct access to this workspace
                </p>
              </div>

              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(true)}
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Invite Member
                </Button>
              )}
            </div>

            <div className="bg-white border border-[#E7EAF0] rounded-2xl divide-y divide-[#E7EAF0] shadow-xs overflow-hidden">
              {members.map((m) => {
                const isMemberOwner = m.role === 'owner';
                const canModifyThisMember = isOwner && !isMemberOwner;

                return (
                  <div key={m.uid} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#172033]">{m.displayName}</h4>
                          {m.uid === currentUser?.uid && (
                            <span className="text-[10px] text-[#64748B] font-semibold bg-[#F0EAFE] text-[#635BFF] px-1.5 py-0.2 rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B]">{m.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Role Pill or Role Selector */}
                      {canModifyThisMember ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m, e.target.value as WorkspaceRole)}
                          className="text-xs font-semibold bg-[#F8FAFC] border border-[#E7EAF0] rounded-xl px-3 py-1.5 text-[#172033] hover:border-slate-300 focus:outline-hidden cursor-pointer"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge
                          variant={isMemberOwner ? 'indigo' : m.role === 'admin' ? 'warning' : 'neutral'}
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          {isMemberOwner ? (
                            <Crown className="w-3 h-3 text-[#635BFF]" />
                          ) : m.role === 'admin' ? (
                            <Shield className="w-3 h-3 text-amber-600" />
                          ) : (
                            <User className="w-3 h-3 text-[#64748B]" />
                          )}
                          <span className="capitalize">{m.role}</span>
                        </Badge>
                      )}

                      {/* Remove Button (Owner/Admin removing non-owner) */}
                      {isAdmin && !isMemberOwner && m.uid !== currentUser?.uid && (
                        <button
                          onClick={() => setMemberToRemove(m)}
                          className="p-1.5 text-[#64748B] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove member"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workspace Invitations & Sharing Section */}
          {isAdmin && (
            <div className="space-y-6 pt-4 border-t border-[#E7EAF0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#172033]">
                    Workspace Sharing & Access
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Active shareable links, 6-digit join codes, and sent invitations
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(true)}
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Invite or Share
                </Button>
              </div>

              {/* Active Sharing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Link Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#F0EAFE] text-[#635BFF]">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#172033]">Shareable Link</h4>
                      </div>
                      {activeLink ? (
                        <Badge variant="success" size="sm">Active</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">None Active</Badge>
                      )}
                    </div>

                    {activeLink ? (
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/join-workspace?token=${activeLink.token || activeLink.id.replace('link_', '')}`}
                            className="flex-1 bg-[#F8FAFC] text-slate-800 text-xs font-mono border border-[#E7EAF0] rounded-xl px-2.5 py-1.5 select-all focus:outline-hidden"
                          />
                          <Button
                            type="button"
                            variant={copiedInviteId === activeLink.id ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() =>
                              handleCopyInviteText(
                                activeLink.id,
                                `${window.location.origin}/join-workspace?token=${activeLink.token || activeLink.id.replace('link_', '')}`
                              )
                            }
                            icon={copiedInviteId === activeLink.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          >
                            {copiedInviteId === activeLink.id ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                          <span>Expires: {formatInviteExpiry(activeLink.expiresAt)}</span>
                          <span>
                            {activeLink.usedCount || 0} / {activeLink.maxUses ? activeLink.maxUses : 'Unlimited'} used
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                        No active shareable link. Create one to share easily on WhatsApp, Telegram, or Slack.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#E7EAF0] flex items-center justify-end">
                    {activeLink ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvitation(activeLink)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px]"
                      >
                        Revoke Link
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsInviteModalOpen(true)}
                        icon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Create Link
                      </Button>
                    )}
                  </div>
                </div>

                {/* Active 6-Digit Code Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#F0EAFE] text-[#635BFF]">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#172033]">6-Digit Join Code</h4>
                      </div>
                      {activeCode ? (
                        <Badge variant="indigo" size="sm">Active Code</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">None Active</Badge>
                      )}
                    </div>

                    {activeCode ? (
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F0EAFE]/40 border border-[#635BFF]/15">
                          <span className="text-xl font-mono font-extrabold text-[#635BFF] tracking-[0.35em]">
                            {activeCode.code || activeCode.id.replace('code_', '')}
                          </span>
                          <Button
                            type="button"
                            variant={copiedInviteId === activeCode.id ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() =>
                              handleCopyInviteText(
                                activeCode.id,
                                activeCode.code || activeCode.id.replace('code_', '')
                              )
                            }
                            icon={copiedInviteId === activeCode.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          >
                            {copiedInviteId === activeCode.id ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                          <span>Expires: {formatInviteExpiry(activeCode.expiresAt)}</span>
                          <span>
                            {activeCode.usedCount || 0} / {activeCode.maxUses ? activeCode.maxUses : 'Unlimited'} used
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                        No active 6-digit code. Generate one so teammates can join directly from the Workspaces page.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#E7EAF0] flex items-center justify-end">
                    {activeCode ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvitation(activeCode)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px]"
                      >
                        Revoke Code
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsInviteModalOpen(true)}
                        icon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Generate Code
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* All Invitations List & Audit History */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <h4 className="text-xs font-bold text-[#172033]">
                    Invitation History ({sentInvitations.length})
                  </h4>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] rounded-xl border border-[#E7EAF0] self-start sm:self-auto text-xs">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'email', label: 'Email' },
                        { id: 'link', label: 'Links' },
                        { id: 'code', label: 'Codes' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setInviteFilterType(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          inviteFilterType === f.id
                            ? 'bg-white text-[#635BFF] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#172033]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredInvitations.length > 0 ? (
                  <div className="bg-white border border-[#E7EAF0] rounded-2xl divide-y divide-[#E7EAF0] shadow-xs overflow-hidden">
                    {filteredInvitations.map((inv) => {
                      const isEmail =
                        inv.type === 'email' ||
                        (!inv.type &&
                          !inv.id.startsWith('link_') &&
                          !inv.id.startsWith('code_'));
                      const isLink = inv.type === 'link' || inv.id.startsWith('link_');
                      const isCode = inv.type === 'code' || inv.id.startsWith('code_');
                      const isRevocable = inv.status === 'active' || inv.status === 'pending';

                      return (
                        <div
                          key={inv.id}
                          className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-[#F0EAFE] text-[#635BFF] shrink-0 mt-0.5">
                              {isEmail ? (
                                <Mail className="w-3.5 h-3.5" />
                              ) : isLink ? (
                                <Link2 className="w-3.5 h-3.5" />
                              ) : (
                                <KeyRound className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-[#172033]">
                                  {isEmail
                                    ? inv.recipientEmail
                                    : isLink
                                    ? `Shareable Link (${inv.id.slice(-6)})`
                                    : `6-Digit Code (${inv.code || inv.id.replace('code_', '')})`}
                                </p>

                                <Badge
                                  variant={
                                    inv.status === 'active' || inv.status === 'accepted'
                                      ? 'success'
                                      : inv.status === 'pending'
                                      ? 'warning'
                                      : inv.status === 'revoked'
                                      ? 'rose'
                                      : 'neutral'
                                  }
                                  size="sm"
                                  className="capitalize"
                                >
                                  {inv.status}
                                </Badge>
                              </div>

                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                Role:{' '}
                                <span className="capitalize font-semibold text-[#635BFF]">
                                  {inv.role}
                                </span>{' '}
                                &bull; Sent by {inv.inviterName}
                                {(isLink || isCode) && (
                                  <>
                                    {' '}&bull; Usage: {inv.usedCount || 0} /{' '}
                                    {inv.maxUses ? inv.maxUses : 'Unlimited'}
                                  </>
                                )}
                                {inv.expiresAt && (
                                  <> &bull; Expires: {formatInviteExpiry(inv.expiresAt)}</>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {isLink && isRevocable && (
                              <Button
                                type="button"
                                variant={copiedInviteId === inv.id ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() =>
                                  handleCopyInviteText(
                                    inv.id,
                                    `${window.location.origin}/join-workspace?token=${inv.token || inv.id.replace('link_', '')}`
                                  )
                                }
                                icon={
                                  copiedInviteId === inv.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )
                                }
                                className="text-[11px]"
                              >
                                {copiedInviteId === inv.id ? 'Copied' : 'Copy Link'}
                              </Button>
                            )}

                            {isCode && isRevocable && (
                              <Button
                                type="button"
                                variant={copiedInviteId === inv.id ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() =>
                                  handleCopyInviteText(
                                    inv.id,
                                    inv.code || inv.id.replace('code_', '')
                                  )
                                }
                                icon={
                                  copiedInviteId === inv.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )
                                }
                                className="text-[11px]"
                              >
                                {copiedInviteId === inv.id ? 'Copied' : 'Copy Code'}
                              </Button>
                            )}

                            {isRevocable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeInvitation(inv)}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px]"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white text-xs text-[#64748B]">
                    No invitations found matching this filter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVITY TIMELINE */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#172033]">Workspace Activity Audit Trail</h3>
            <p className="text-xs text-[#64748B]">
              Chronological timeline of changes, task updates, and membership events
            </p>
          </div>

          {activities.length > 0 ? (
            <div className="bg-white border border-[#E7EAF0] rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7EAF0]">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start justify-between gap-4">
                    {/* Event Dot */}
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#635BFF] border-2 border-white ring-4 ring-[#F0EAFE]" />
                    <div>
                      <p className="text-xs font-semibold text-[#172033]">
                        <span className="text-[#635BFF] font-bold">{act.actorName}</span> &bull;{' '}
                        <span className="text-[#172033] font-medium">{act.details}</span>
                      </p>
                      <p className="text-[10px] text-[#64748B] mt-0.5 font-mono">
                        {formatActivityTime(act.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white text-xs text-[#64748B]">
              No activity recorded yet in this workspace.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS (Admin/Owner only) */}
      {activeTab === 'settings' && isAdmin && (
        <div className="max-w-2xl space-y-8">
          {/* General Details Form */}
          <Card>
            <h3 className="text-sm font-bold text-[#172033] mb-1">Workspace Details</h3>
            <p className="text-xs text-[#64748B] mb-5">
              Update your workspace identity and description
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <Input
                label="Workspace Name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="edit-workspace-desc"
                  className="block text-xs font-semibold text-[#172033] tracking-wide"
                >
                  Description
                </label>
                <textarea
                  id="edit-workspace-desc"
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-white text-[#172033] text-sm placeholder:text-[#64748B] border border-[#E7EAF0] focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 hover:border-slate-300 rounded-xl p-3 transition-all duration-150 focus:outline-hidden"
                />
              </div>

              <Input
                label="Workspace Type"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
              />

              <div className="pt-2">
                <Button type="submit" variant="primary" size="sm" loading={savingSettings}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Danger Zone: Delete Workspace (Owner only) */}
          {isOwner && (
            <div className="border border-rose-200 bg-gradient-to-br from-[#FFF0E5]/60 to-[#FFF7ED] rounded-2xl p-6 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-rose-950">Danger Zone</h3>
                  <p className="text-xs text-rose-700 mt-1">
                    Permanently delete this workspace and remove all shared tasks and membership data.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeleteWorkspaceModalOpen(true)}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Workspace
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Comments & Discussion Modal */}
      <TaskCommentsModal
        isOpen={Boolean(activeCommentTask)}
        onClose={() => setActiveCommentTask(null)}
        task={activeCommentTask}
        workspace={workspace}
        canModerate={isAdmin}
      />

      {/* Task Create / Edit Modal */}
      <SharedTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
        taskToEdit={taskToEdit}
        members={members}
      />

      {/* Delete Task Confirmation Modal */}
      <Modal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Delete Shared Task"
        description={`Are you sure you want to permanently delete "${taskToDelete?.title}"?`}
        maxWidth="sm"
      >
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" size="md" onClick={() => setTaskToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleDeleteTask}>
            Delete Task
          </Button>
        </div>
      </Modal>

      {/* Invite Member Modal */}
      {workspace && currentUser && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onInviteEmail={handleSendInvitation}
          workspace={workspace}
          currentUser={{
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Member',
          }}
          onSuccess={(msg) => setFeedback({ type: 'success', message: msg })}
        />
      )}

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${memberToRemove?.displayName} from ${workspace.name}? They will lose access to all shared tasks.`}
        maxWidth="sm"
      >
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" size="md" onClick={() => setMemberToRemove(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleRemoveMember}>
            Remove Member
          </Button>
        </div>
      </Modal>

      {/* Leave Workspace Confirmation Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Leave Workspace"
        description={`Are you sure you want to leave ${workspace.name}? You will need an invitation from a workspace admin to rejoin.`}
        maxWidth="sm"
      >
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" size="md" onClick={() => setIsLeaveModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleLeaveWorkspace}>
            Leave Workspace
          </Button>
        </div>
      </Modal>

      {/* Delete Workspace Confirmation Modal */}
      <Modal
        isOpen={isDeleteWorkspaceModalOpen}
        onClose={() => setIsDeleteWorkspaceModalOpen(false)}
        title="Delete Entire Workspace"
        description={`This action will permanently delete "${workspace.name}" and all associated tasks and activity records for all ${members.length} members. This cannot be undone.`}
        maxWidth="sm"
      >
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsDeleteWorkspaceModalOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleDeleteWorkspace}>
            Permanently Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};
