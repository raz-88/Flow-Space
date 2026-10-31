import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
} from '../services/taskService';
import {
  subscribeToUserWorkspaces,
  subscribeToWorkspaceTasks,
} from '../services/workspaceService';
import { updateUserProfile } from '../services/userService';
import type { Task, TaskFilterTab, TaskFormData, TaskStatus } from '../types/task';
import type { Workspace, SharedTask } from '../types/workspace';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskModal } from '../components/tasks/TaskModal';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import {
  Plus,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ListTodo,
  User,
  ShieldCheck,
  Mail,
  Edit2,
  RefreshCw,
  LogOut,
  Copy,
  Check,
  Layers,
  Inbox,
  Briefcase,
  UserCheck,
  ArrowRight,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export const DashboardPage: React.FC = () => {
  const { currentUser, userProfile, refreshProfile, logout } = useAuth();

  // Navigation tab within dashboard: 'overview' | 'planner' | 'assigned' | 'profile'
  const [activeDashboardSection, setActiveDashboardSection] = useState<
    'overview' | 'planner' | 'assigned' | 'profile'
  >('overview');

  // Personal Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Workspaces & Shared Tasks state for Unified Metrics
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceTasksMap, setWorkspaceTasksMap] = useState<Record<string, SharedTask[]>>({});
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState<string>('all');

  // Filter state for personal planner
  const [activeTab, setActiveTab] = useState<TaskFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(
    userProfile?.displayName || currentUser?.displayName || ''
  );
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Subscribe to personal tasks in real-time
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);
    setTasksError(null);

    const unsubscribe = subscribeToUserTasks(
      currentUser.uid,
      (fetchedTasks) => {
        setTasks(fetchedTasks);
        setLoadingTasks(false);
      },
      (err) => {
        console.error('Task subscription failed:', err);
        setTasksError('Failed to load tasks from cloud storage. Please check connection.');
        setLoadingTasks(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 2. Subscribe to user workspaces in real-time
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = subscribeToUserWorkspaces(
      currentUser.uid,
      (wsList) => setWorkspaces(wsList),
      (err) => console.warn('Could not fetch user workspaces for dashboard:', err)
    );

    return () => unsub();
  }, [currentUser?.uid]);

  // 3. Subscribe to shared tasks across workspaces
  useEffect(() => {
    if (workspaces.length === 0) {
      setWorkspaceTasksMap({});
      return;
    }

    const unsubs: (() => void)[] = [];
    workspaces.forEach((ws) => {
      const u = subscribeToWorkspaceTasks(
        ws.id,
        (wsTasks) => {
          setWorkspaceTasksMap((prev) => ({ ...prev, [ws.id]: wsTasks }));
        },
        () => {}
      );
      unsubs.push(u);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [workspaces]);

  // All shared tasks assigned to current user
  const assignedTeamTasks = useMemo(() => {
    const list: (SharedTask & { workspaceName: string })[] = [];
    workspaces.forEach((ws) => {
      const wsTasks = workspaceTasksMap[ws.id] || [];
      wsTasks.forEach((t) => {
        if (t.assignedToUid === currentUser?.uid) {
          list.push({ ...t, workspaceName: ws.name });
        }
      });
    });
    return list;
  }, [workspaces, workspaceTasksMap, currentUser?.uid]);

  // Discover all unique categories currently in use in personal planner
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [tasks]);

  // Categorize personal tasks
  const { todayTasks, upcomingTasks, overdueTasks, completedTasks } = useMemo(() => {
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const overdue: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach((task) => {
      if (task.status === 'completed') {
        completed.push(task);
      } else if (task.dueDate < todayStr) {
        overdue.push(task);
      } else if (task.dueDate === todayStr) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return {
      todayTasks: today,
      upcomingTasks: upcoming,
      overdueTasks: overdue,
      completedTasks: completed,
    };
  }, [tasks, todayStr]);

  // Categorize assigned team tasks
  const {
    assignedToday,
    assignedUpcoming,
    assignedOverdue,
    assignedCompleted,
  } = useMemo(() => {
    const today: (SharedTask & { workspaceName: string })[] = [];
    const upcoming: (SharedTask & { workspaceName: string })[] = [];
    const overdue: (SharedTask & { workspaceName: string })[] = [];
    const completed: (SharedTask & { workspaceName: string })[] = [];

    assignedTeamTasks.forEach((t) => {
      if (t.status === 'completed') {
        completed.push(t);
      } else if (t.dueDate < todayStr) {
        overdue.push(t);
      } else if (t.dueDate === todayStr) {
        today.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return {
      assignedToday: today,
      assignedUpcoming: upcoming,
      assignedOverdue: overdue,
      assignedCompleted: completed,
    };
  }, [assignedTeamTasks, todayStr]);

  // Unified Metrics
  const unifiedMetrics = useMemo(() => {
    const totalToday = todayTasks.length + assignedToday.length;
    const totalUpcoming = upcomingTasks.length + assignedUpcoming.length;
    const totalOverdue = overdueTasks.length + assignedOverdue.length;
    const totalCompleted = completedTasks.length + assignedCompleted.length;
    const totalActive = totalToday + totalUpcoming + totalOverdue;
    const overallTotal = totalActive + totalCompleted;
    const completionRate = overallTotal > 0 ? Math.round((totalCompleted / overallTotal) * 100) : 0;

    return {
      totalToday,
      totalUpcoming,
      totalOverdue,
      totalCompleted,
      totalActive,
      completionRate,
      assignedCount: assignedTeamTasks.length,
    };
  }, [
    todayTasks,
    assignedToday,
    upcomingTasks,
    assignedUpcoming,
    overdueTasks,
    assignedOverdue,
    completedTasks,
    assignedCompleted,
    assignedTeamTasks,
  ]);

  // Workspace completion summaries
  const workspaceSummaries = useMemo(() => {
    return workspaces.map((ws) => {
      const wsTasks = workspaceTasksMap[ws.id] || [];
      const total = wsTasks.length;
      const completed = wsTasks.filter((t) => t.status === 'completed').length;
      const active = total - completed;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...ws,
        taskCount: total,
        completedCount: completed,
        activeCount: active,
        rate,
      };
    });
  }, [workspaces, workspaceTasksMap]);

  // Filter personal tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isCompleted = task.status === 'completed';

      if (activeTab === 'today') {
        if (isCompleted || task.dueDate !== todayStr) return false;
      } else if (activeTab === 'upcoming') {
        if (isCompleted || task.dueDate <= todayStr) return false;
      } else if (activeTab === 'overdue') {
        if (isCompleted || task.dueDate >= todayStr) return false;
      } else if (activeTab === 'completed') {
        if (!isCompleted) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      if (selectedCategory !== 'all' && task.category !== selectedCategory) {
        return false;
      }

      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [tasks, activeTab, searchQuery, selectedCategory, selectedPriority, todayStr]);

  // Handlers
  const handleCreateOrUpdateTask = async (formData: TaskFormData) => {
    if (!currentUser?.uid) return;

    try {
      if (taskToEdit) {
        await updateTask(currentUser.uid, taskToEdit.id, formData);
        setFeedback({ type: 'success', message: 'Task updated successfully.' });
        setTaskToEdit(null);
      } else {
        await createTask(currentUser.uid, {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          dueDate: formData.dueDate,
          dueTime: formData.dueTime,
          category: formData.category,
          status: formData.status,
          reminderMinutes: formData.reminderMinutes,
          recurrence: formData.recurrence,
          recurrenceEndDate: formData.recurrenceEndDate,
        });
        setFeedback({ type: 'success', message: 'New task created.' });
      }
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save task.',
      });
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (!currentUser?.uid) return;
    try {
      await toggleTaskComplete(currentUser.uid, task);
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Could not update task status.' });
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    if (!currentUser?.uid) return;
    try {
      await updateTask(currentUser.uid, task.id, { status: newStatus });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Could not update task status.' });
    }
  };

  const handleDeleteTask = async () => {
    if (!currentUser?.uid || !taskToDeleteId) return;
    try {
      await deleteTask(currentUser.uid, taskToDeleteId);
      setFeedback({ type: 'success', message: 'Task removed.' });
      setTaskToDeleteId(null);
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to delete task.' });
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid || !newDisplayName.trim()) return;

    try {
      setUpdatingProfile(true);
      await updateUserProfile(currentUser.uid, {
        displayName: newDisplayName.trim(),
      });
      await refreshProfile();
      setIsEditingProfile(false);
      setFeedback({ type: 'success', message: 'Display name updated.' });
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to update profile.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCopyUid = () => {
    if (currentUser?.uid) {
      navigator.clipboard.writeText(currentUser.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const displayName = userProfile?.displayName || currentUser?.displayName || 'FlowSpace Member';

  const formatDate = (dateVal: unknown) => {
    if (!dateVal) return 'N/A';
    if (typeof (dateVal as Timestamp)?.toDate === 'function') {
      return (dateVal as Timestamp).toDate().toLocaleString();
    }
    if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      return new Date(dateVal).toLocaleString();
    }
    return 'Recently';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7EAF0] mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight">
              {activeDashboardSection === 'overview'
                ? 'Productivity Hub'
                : activeDashboardSection === 'planner'
                ? 'Personal Planner'
                : activeDashboardSection === 'assigned'
                ? 'Assigned Team Tasks'
                : 'Account & Security'}
            </h1>
            <Badge variant="indigo" size="sm">
              FlowSpace
            </Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Welcome back, <span className="font-semibold text-[#172033]">{displayName}</span> &bull;{' '}
            {tasks.length} personal tasks &bull; {assignedTeamTasks.length} assigned team tasks
          </p>
        </div>

        {/* Section Tabs & New Task CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex p-1 bg-white rounded-xl text-xs font-medium border border-[#E7EAF0] shadow-xs">
            <button
              onClick={() => setActiveDashboardSection('overview')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeDashboardSection === 'overview'
                  ? 'bg-[#F0EAFE] text-[#635BFF] font-semibold border border-[#635BFF]/20 shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveDashboardSection('planner')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeDashboardSection === 'planner'
                  ? 'bg-[#F0EAFE] text-[#635BFF] font-semibold border border-[#635BFF]/20 shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Planner
            </button>
            <button
              onClick={() => setActiveDashboardSection('assigned')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeDashboardSection === 'assigned'
                  ? 'bg-[#F0EAFE] text-[#635BFF] font-semibold border border-[#635BFF]/20 shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              <span>Assigned</span>
              {assignedTeamTasks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-[#635BFF] font-bold border border-[#635BFF]/30">
                  {assignedTeamTasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveDashboardSection('profile')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeDashboardSection === 'profile'
                  ? 'bg-[#F0EAFE] text-[#635BFF] font-semibold border border-[#635BFF]/20 shadow-xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Account
            </button>
          </div>

          {activeDashboardSection === 'planner' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {tasksError && (
        <div className="mb-6">
          <Alert type="error" message={tasksError} onClose={() => setTasksError(null)} />
        </div>
      )}

      {feedback && (
        <div className="mb-6">
          <Alert
            type={feedback.type}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        </div>
      )}

      {/* SECTION 0: UNIFIED PRODUCTIVITY OVERVIEW */}
      {activeDashboardSection === 'overview' && (
        <div className="space-y-8">
          {/* Unified Metrics Row with Soft Gradients & Distinctive Colors */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Due Today - Soft Blue */}
            <div className="p-5 rounded-2xl border border-[#D4E3FC] bg-gradient-to-br from-[#E8F0FF] to-[#F0EAFE] shadow-xs">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">Due Today</span>
                <div className="p-1.5 rounded-lg bg-white/80 text-blue-600 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
                {unifiedMetrics.totalToday}
              </div>
              <p className="text-[11px] text-blue-800/80 mt-1 font-medium">
                {todayTasks.length} personal + {assignedToday.length} team
              </p>
            </div>

            {/* Upcoming - Soft Lavender */}
            <div className="p-5 rounded-2xl border border-[#E0D4FC] bg-gradient-to-br from-[#F0EAFE] to-[#F5F0FF] shadow-xs">
              <div className="flex items-center justify-between text-[#635BFF] mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#635BFF]">Upcoming</span>
                <div className="p-1.5 rounded-lg bg-white/80 text-[#635BFF] shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
                {unifiedMetrics.totalUpcoming}
              </div>
              <p className="text-[11px] text-[#635BFF]/80 mt-1 font-medium">Future deadlines</p>
            </div>

            {/* Overdue - Soft Peach */}
            <div
              className={`p-5 rounded-2xl border shadow-xs ${
                unifiedMetrics.totalOverdue > 0
                  ? 'border-rose-200 bg-gradient-to-br from-[#FFF0E5] to-[#FFF7ED]'
                  : 'border-[#E7EAF0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    unifiedMetrics.totalOverdue > 0 ? 'text-rose-700' : 'text-[#64748B]'
                  }`}
                >
                  Overdue
                </span>
                <div
                  className={`p-1.5 rounded-lg shadow-2xs ${
                    unifiedMetrics.totalOverdue > 0
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-[#F8FAFC] text-[#64748B]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold ${
                  unifiedMetrics.totalOverdue > 0 ? 'text-rose-600' : 'text-[#172033]'
                }`}
              >
                {unifiedMetrics.totalOverdue}
              </div>
              <p
                className={`text-[11px] mt-1 font-medium ${
                  unifiedMetrics.totalOverdue > 0 ? 'text-rose-700' : 'text-[#64748B]'
                }`}
              >
                {unifiedMetrics.totalOverdue > 0 ? 'Requires attention' : 'All caught up'}
              </p>
            </div>

            {/* Completed - Soft Mint */}
            <div className="p-5 rounded-2xl border border-[#BBF7D0] bg-gradient-to-br from-[#E2F8EE] to-[#F0FDF4] shadow-xs">
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Completed</span>
                <div className="p-1.5 rounded-lg bg-white/80 text-emerald-600 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                {unifiedMetrics.totalCompleted}
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-1 font-medium">
                {unifiedMetrics.completionRate}% completion rate
              </p>
            </div>

            {/* Assigned to Me - White with Brand Accent */}
            <div className="p-5 rounded-2xl border border-[#E7EAF0] bg-white shadow-xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Assigned to Me</span>
                <div className="p-1.5 rounded-lg bg-[#F0EAFE] text-[#635BFF] shadow-2xs">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
                {unifiedMetrics.assignedCount}
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">
                Across {workspaces.length} workspaces
              </p>
            </div>
          </div>

          {/* Today's Agenda: Personal + Team Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#635BFF]" />
                  <span>Today's Focus & Deadlines</span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Consolidated view of your personal planner and assigned team tasks due today
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveDashboardSection('planner')}
                className="text-xs font-semibold text-[#635BFF] hover:text-[#5145E5] flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Planner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayTasks.length === 0 && assignedToday.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E7EAF0]">
                <div className="w-10 h-10 rounded-xl bg-[#E2F8EE] text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172033]">No tasks scheduled for today</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  You are all caught up for today! Plan ahead in your personal planner.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Personal tasks today */}
                {todayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs hover:border-[#635BFF]/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#172033] truncate">
                          {t.title}
                        </span>
                        <Badge variant="indigo" size="sm">
                          Personal
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1 flex items-center gap-2">
                        <span>Category: {t.category}</span>
                        {t.dueTime && <span>Time: {t.dueTime}</span>}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleComplete(t)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#E2F8EE] text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ))}

                {/* Team tasks today */}
                {assignedToday.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs hover:border-[#635BFF]/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#172033] truncate">
                          {t.title}
                        </span>
                        <Badge variant="warning" size="sm">
                          {t.workspaceName}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1 flex items-center gap-2">
                        <span>Priority: {t.priority}</span>
                        {t.dueTime && <span>Time: {t.dueTime}</span>}
                      </p>
                    </div>

                    <Link
                      to={`/workspaces/${t.workspaceId}?tab=tasks`}
                      className="p-2 text-[#64748B] hover:text-[#635BFF] rounded-xl hover:bg-[#F0EAFE] transition-colors"
                      title="Open in Workspace"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workspace Progress & Health Summaries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#635BFF]" />
                  <span>Workspace Task Completion Summary</span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Completion rate across team workspaces where you collaborate
                </p>
              </div>

              <Link
                to="/workspaces"
                className="text-xs font-semibold text-[#635BFF] hover:text-[#5145E5] flex items-center gap-1"
              >
                <span>All Workspaces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {workspaceSummaries.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E7EAF0]">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#64748B] flex items-center justify-center mx-auto mb-2">
                  <Briefcase className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172033]">No workspaces joined yet</p>
                <p className="text-[11px] text-[#64748B] mt-0.5 mb-3">
                  Create a workspace to collaborate with teammates on shared tasks.
                </p>
                <Link to="/workspaces">
                  <Button variant="outline" size="sm">
                    Go to Workspaces
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaceSummaries.map((ws) => (
                  <Link
                    key={ws.id}
                    to={`/workspaces/${ws.id}?tab=tasks`}
                    className="p-5 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs hover:shadow-md hover:border-[#635BFF]/40 hover:-translate-y-0.5 transition-all block group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h4 className="text-xs font-bold text-[#172033] group-hover:text-[#635BFF] transition-colors truncate">
                        {ws.name}
                      </h4>
                      <span className="text-[10px] font-mono text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E7EAF0]">
                        {ws.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                      <span>Progress</span>
                      <span className="font-semibold text-[#172033]">{ws.rate}%</span>
                    </div>

                    {/* Progress Bar with Soft Brand Gradient */}
                    <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${ws.rate}%`,
                          background: 'linear-gradient(135deg, #635BFF 0%, #8B5CF6 100%)',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] border-t border-[#E7EAF0] pt-2.5">
                      <span>{ws.activeCount} active tasks</span>
                      <span className="text-emerald-700 font-semibold">
                        {ws.completedCount} completed
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 1: PERSONAL PLANNER & TASK MANAGEMENT */}
      {activeDashboardSection === 'planner' && (
        <div className="space-y-8">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tasks */}
            <div className="p-5 rounded-2xl border border-[#E7EAF0] bg-white shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Total Tasks</span>
                <div className="p-1.5 rounded-lg bg-[#F0EAFE] text-[#635BFF] shadow-2xs">
                  <ListTodo className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
                {tasks.length}
              </div>
              <p className="text-[11px] text-[#64748B] mt-1 font-medium">Across all categories</p>
            </div>

            {/* Due Today */}
            <div className="p-5 rounded-2xl border border-[#D4E3FC] bg-gradient-to-br from-[#E8F0FF] to-[#F0EAFE] shadow-xs">
              <div className="flex items-center justify-between text-blue-800 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">Due Today</span>
                <div className="p-1.5 rounded-lg bg-white/80 text-blue-600 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
                {todayTasks.length}
              </div>
              <p className="text-[11px] text-blue-800/80 mt-1 font-medium">
                {todayTasks.length === 0 ? 'All clear today' : 'Scheduled for today'}
              </p>
            </div>

            {/* Overdue */}
            <div
              className={`p-5 rounded-2xl border shadow-xs ${
                overdueTasks.length > 0
                  ? 'border-rose-200 bg-gradient-to-br from-[#FFF0E5] to-[#FFF7ED]'
                  : 'border-[#E7EAF0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    overdueTasks.length > 0 ? 'text-rose-700' : 'text-[#64748B]'
                  }`}
                >
                  Overdue
                </span>
                <div
                  className={`p-1.5 rounded-lg shadow-2xs ${
                    overdueTasks.length > 0
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-[#F8FAFC] text-[#64748B]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold ${
                  overdueTasks.length > 0 ? 'text-rose-600' : 'text-[#172033]'
                }`}
              >
                {overdueTasks.length}
              </div>
              <p
                className={`text-[11px] mt-1 font-medium ${
                  overdueTasks.length > 0 ? 'text-rose-700' : 'text-[#64748B]'
                }`}
              >
                {overdueTasks.length > 0 ? 'Needs immediate attention' : 'No overdue items'}
              </p>
            </div>

            {/* Completed */}
            <div className="p-5 rounded-2xl border border-[#BBF7D0] bg-gradient-to-br from-[#E2F8EE] to-[#F0FDF4] shadow-xs">
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Completed</span>
                <div className="p-1.5 rounded-lg bg-white/80 text-emerald-600 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                {completedTasks.length}
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-1 font-medium">
                {tasks.length > 0
                  ? `${Math.round((completedTasks.length / tasks.length) * 100)}% completion rate`
                  : 'Start completing tasks'}
              </p>
            </div>
          </div>

          {/* Filters & Tabs */}
          <TaskFilters
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            categories={existingCategories}
            counts={{
              all: tasks.length,
              today: todayTasks.length,
              upcoming: upcomingTasks.length,
              overdue: overdueTasks.length,
              completed: completedTasks.length,
            }}
            onClearFilters={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedPriority('all');
            }}
          />

          {/* Tasks List */}
          <div className="space-y-3">
            {loadingTasks ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono">Syncing personal tasks with Firestore...</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={(t) => {
                      setTaskToEdit(t);
                      setIsTaskModalOpen(true);
                    }}
                    onDelete={(id) => setTaskToDeleteId(id)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            ) : (
              /* Contextual Empty State */
              <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white">
                <div className="w-12 h-12 rounded-2xl bg-[#F0EAFE] text-[#635BFF] flex items-center justify-center mx-auto mb-3 border border-[#635BFF]/20">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033] mb-1">
                  {searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all'
                    ? 'No matching tasks found'
                    : activeTab === 'today'
                    ? 'No tasks due today'
                    : activeTab === 'upcoming'
                    ? 'No upcoming tasks scheduled'
                    : activeTab === 'overdue'
                    ? 'All caught up! No overdue tasks'
                    : activeTab === 'completed'
                    ? 'No completed tasks yet'
                    : 'Your task list is empty'}
                </h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-5 leading-relaxed">
                  {searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all'
                    ? 'Try clearing or broadening your search keywords and filter criteria.'
                    : activeTab === 'today'
                    ? 'Enjoy your focus time, or schedule ahead by adding a new item.'
                    : activeTab === 'overdue'
                    ? 'Great job keeping up with your deadlines.'
                    : 'Create and organize tasks with priorities, due dates, and custom categories.'}
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
                  Create New Task
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: ASSIGNED TEAM TASKS */}
      {activeDashboardSection === 'assigned' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E7EAF0] shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#635BFF]" />
                <span>Tasks Assigned to You</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Shared tasks assigned to your account across all team workspaces
              </p>
            </div>

            {/* Workspace Filter */}
            {workspaces.length > 0 && (
              <select
                value={selectedWorkspaceFilter}
                onChange={(e) => setSelectedWorkspaceFilter(e.target.value)}
                className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
              >
                <option value="all">All Workspaces</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {assignedTeamTasks.length === 0 ? (
            <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-[#E7EAF0] bg-white">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EAFE] text-[#635BFF] flex items-center justify-center mx-auto mb-3 border border-[#635BFF]/20">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#172033] mb-1">
                No tasks assigned to you
              </h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-4">
                When workspace collaborators assign shared tasks to you, they will appear here.
              </p>
              <Link to="/workspaces">
                <Button variant="primary" size="sm">
                  View Workspaces
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {assignedTeamTasks
                .filter(
                  (t) =>
                    selectedWorkspaceFilter === 'all' ||
                    t.workspaceId === selectedWorkspaceFilter
                )
                .map((t) => {
                  const isCompleted = t.status === 'completed';
                  const isOverdue = !isCompleted && t.dueDate < todayStr;

                  return (
                    <div
                      key={t.id}
                      className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all duration-150 shadow-xs flex items-start justify-between gap-3 ${
                        isCompleted
                          ? 'border-[#E7EAF0] bg-[#F8FAFC]/60 opacity-75'
                          : isOverdue
                          ? 'border-rose-200 hover:border-rose-300 bg-[#FFF0E5]/20'
                          : 'border-[#E7EAF0] hover:border-[#635BFF]/30 hover:shadow-md'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h4
                            className={`text-sm font-semibold tracking-tight ${
                              isCompleted ? 'line-through text-[#64748B]' : 'text-[#172033]'
                            }`}
                          >
                            {t.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20">
                            {t.workspaceName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                              t.priority === 'high'
                                ? 'bg-[#FFF0E5] text-rose-700 border-rose-200'
                                : t.priority === 'medium'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-[#E7EAF0]'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        {t.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                            {t.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Due {t.dueDate}</span>
                          </span>
                          <span>Assigned by {t.createdByName}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          to={`/workspaces/${t.workspaceId}?tab=tasks`}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                        >
                          <span>Open Task</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: ACCOUNT & SECURITY */}
      {activeDashboardSection === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E7EAF0]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#172033]">User Profile (Firestore)</h2>
                    <p className="text-xs text-[#64748B]">Document path: users/{currentUser?.uid}</p>
                  </div>
                </div>

                {!isEditingProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewDisplayName(displayName);
                      setIsEditingProfile(true);
                    }}
                    icon={<Edit2 className="w-3 h-3" />}
                  >
                    Edit Name
                  </Button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleUpdateName} className="space-y-4 pt-1">
                  <Input
                    label="Display Name"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" variant="primary" size="sm" loading={updatingProfile}>
                      Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0]">
                    <span className="text-[#64748B] block mb-1 text-[11px] font-medium uppercase tracking-wider">
                      Display Name
                    </span>
                    <span className="font-semibold text-[#172033] text-sm">{displayName}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0]">
                    <span className="text-[#64748B] block mb-1 text-[11px] font-medium uppercase tracking-wider">
                      Registered Email
                    </span>
                    <span className="font-semibold text-[#172033] text-sm flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#64748B]" />
                      {currentUser?.email || userProfile?.email || 'N/A'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0] sm:col-span-2">
                    <span className="text-[#64748B] block mb-1 text-[11px] font-medium uppercase tracking-wider">
                      Authenticated UID (Document ID)
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[#172033] text-xs break-all">
                        {currentUser?.uid}
                      </span>
                      <button
                        onClick={handleCopyUid}
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172033] hover:bg-slate-200 transition shrink-0 cursor-pointer"
                        title="Copy UID"
                      >
                        {copiedUid ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0]">
                    <span className="text-[#64748B] block mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider">
                      <Calendar className="w-3 h-3 text-[#64748B]" /> Created At
                    </span>
                    <span className="text-[#172033] font-medium">
                      {formatDate(userProfile?.createdAt || currentUser?.metadata.creationTime)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0]">
                    <span className="text-[#64748B] block mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider">
                      <Calendar className="w-3 h-3 text-[#64748B]" /> Last Synced
                    </span>
                    <span className="text-[#172033] font-medium">
                      {formatDate(userProfile?.updatedAt || currentUser?.metadata.lastSignInTime)}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Firestore Access Control Rules Card */}
            <Card>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2.5 rounded-xl bg-[#E2F8EE] text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#172033]">Firestore Access Control</h2>
                  <p className="text-xs text-[#64748B]">Task isolation enforced at database engine</p>
                </div>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Personal tasks are housed under{' '}
                <code className="text-[#172033] bg-[#F8FAFC] px-1.5 py-0.5 rounded-md font-mono border border-[#E7EAF0]">
                  users/{currentUser?.uid}/tasks/{'{taskId}'}
                </code>
                . Security rules require <code className="text-[#635BFF] font-mono">request.auth.uid == userId</code>,
                preventing unauthorized cross-user queries or modifications.
              </p>
            </Card>
          </div>

          {/* Right Column: Actions */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-sm font-semibold text-[#172033] mb-3">Session Management</h3>
              <div className="space-y-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={async () => {
                    await refreshProfile();
                    setFeedback({ type: 'success', message: 'Profile synced from Firestore.' });
                  }}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Refresh Cloud Data
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={logout}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Sign Out
                </Button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2.5 rounded-xl bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#172033]">Active Modules</h3>
                  <p className="text-xs text-[#64748B]">FlowSpace capabilities</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-[#64748B]">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[#172033] font-medium">Personal Planner & Recurring Tasks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[#172033] font-medium">Team Workspaces & Shared Tasks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[#172033] font-medium">Task Discussion & Comments</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[#172033] font-medium">In-App Notification Center</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
        taskToEdit={taskToEdit}
        existingCategories={existingCategories}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(taskToDeleteId)}
        onClose={() => setTaskToDeleteId(null)}
        title="Delete Task"
        description="Are you sure you want to permanently remove this task? This action cannot be undone."
        maxWidth="sm"
      >
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" size="md" onClick={() => setTaskToDeleteId(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleDeleteTask}>
            Delete Task
          </Button>
        </div>
      </Modal>
    </div>
  );
};
