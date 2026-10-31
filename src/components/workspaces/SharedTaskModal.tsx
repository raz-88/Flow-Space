import React, { useState, useEffect } from 'react';
import type {
  SharedTask,
  SharedTaskPriority,
  SharedTaskStatus,
  SharedTaskRecurrence,
  WorkspaceMember,
} from '../../types/workspace';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Bell, Repeat, Tag, UserCheck } from 'lucide-react';

export interface SharedTaskSubmitData {
  title: string;
  description?: string;
  priority: SharedTaskPriority;
  dueDate: string;
  dueTime?: string;
  status: SharedTaskStatus;
  category?: string;
  assignedToUid?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  reminderMinutes?: number | null;
  recurrence?: SharedTaskRecurrence;
  recurrenceEndDate?: string | null;
}

export interface SharedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SharedTaskSubmitData) => Promise<void>;
  taskToEdit?: SharedTask | null;
  members: WorkspaceMember[];
}

const COMMON_WORKSPACE_CATEGORIES = [
  'General',
  'Engineering',
  'Design',
  'Product',
  'Marketing',
  'Operations',
];

export const SharedTaskModal: React.FC<SharedTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  taskToEdit,
  members,
}) => {
  const isEditing = Boolean(taskToEdit);
  const defaultDueDate = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SharedTaskPriority>('medium');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [dueTime, setDueTime] = useState('');
  const [status, setStatus] = useState<SharedTaskStatus>('pending');
  const [category, setCategory] = useState('General');
  const [assignedToUid, setAssignedToUid] = useState<string>('');
  const [reminderMinutes, setReminderMinutes] = useState<string>('none');
  const [recurrence, setRecurrence] = useState<SharedTaskRecurrence>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority || 'medium');
      setDueDate(taskToEdit.dueDate || defaultDueDate);
      setDueTime(taskToEdit.dueTime || '');
      setStatus(taskToEdit.status || 'pending');
      setCategory(taskToEdit.category || 'General');
      setAssignedToUid(taskToEdit.assignedToUid || '');
      setReminderMinutes(
        taskToEdit.reminderMinutes !== undefined && taskToEdit.reminderMinutes !== null
          ? String(taskToEdit.reminderMinutes)
          : 'none'
      );
      setRecurrence(taskToEdit.recurrence || 'none');
      setRecurrenceEndDate(taskToEdit.recurrenceEndDate || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate(defaultDueDate);
      setDueTime('');
      setStatus('pending');
      setCategory('General');
      setAssignedToUid('');
      setReminderMinutes('none');
      setRecurrence('none');
      setRecurrenceEndDate('');
    }
    setError(null);
  }, [taskToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a task title.');
      return;
    }
    if (!dueDate) {
      setError('Please select a due date.');
      return;
    }

    const assignedMember = members.find((m) => m.uid === assignedToUid);

    try {
      setLoading(true);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate,
        dueTime: dueTime.trim(),
        status,
        category: category.trim() || 'General',
        assignedToUid: assignedToUid || null,
        assignedToName: assignedMember ? assignedMember.displayName : null,
        assignedToEmail: assignedMember ? assignedMember.email : null,
        reminderMinutes: reminderMinutes === 'none' ? null : Number(reminderMinutes),
        recurrence,
        recurrenceEndDate: recurrenceEndDate ? recurrenceEndDate : null,
      });
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Workspace Task' : 'Create Shared Task'}
      description={
        isEditing
          ? 'Modify details, assignees, and reminders for this team task'
          : 'Create a collaborative task for workspace members'
      }
      maxWidth="lg"
    >
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <Input
          label="Task Title *"
          placeholder="e.g. Implement authentication flows"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add relevant instructions, links, or criteria..."
            rows={3}
            className="w-full text-xs p-3 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 resize-none bg-white transition-all text-[#172033] placeholder:text-[#64748B]"
          />
        </div>

        {/* Assignee & Category Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assignee */}
          <div>
            <label className="text-xs font-semibold text-[#172033] mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>Assigned Member</span>
            </label>
            <select
              value={assignedToUid}
              onChange={(e) => setAssignedToUid(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 bg-white text-[#172033]"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName} ({m.role}) — {m.email}
                </option>
              ))}
            </select>
          </div>

          {/* Category / Label */}
          <div>
            <label className="text-xs font-semibold text-[#172033] mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Category / Label</span>
            </label>
            <input
              type="text"
              list="workspace-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Engineering, Design..."
              className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 bg-white text-[#172033]"
            />
            <datalist id="workspace-categories">
              {COMMON_WORKSPACE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as SharedTaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-[#FFF0E5] border-rose-300 text-rose-700 shadow-xs ring-1 ring-rose-400/30'
                        : p === 'medium'
                        ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-xs ring-1 ring-amber-400/30'
                        : 'bg-slate-100 border-slate-300 text-slate-800 shadow-xs ring-1 ring-slate-400/20'
                      : 'bg-white border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['pending', 'in_progress', 'completed'] as SharedTaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border capitalize transition-all cursor-pointer ${
                    status === s
                      ? s === 'completed'
                        ? 'bg-[#E2F8EE] border-emerald-300 text-emerald-800 font-semibold ring-1 ring-emerald-400/30'
                        : s === 'in_progress'
                        ? 'bg-[#E8F0FF] border-blue-300 text-blue-800 font-semibold ring-1 ring-blue-400/30'
                        : 'bg-slate-100 border-slate-300 text-slate-800 font-semibold ring-1 ring-slate-400/20'
                      : 'bg-white border-[#E7EAF0] text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Due Date & Due Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Due Date *"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <Input
            type="time"
            label="Due Time (Optional)"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        {/* Reminders & Recurrence */}
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reminder */}
            <div>
              <label className="text-xs font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>Reminder Alert</span>
              </label>
              <select
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 bg-white text-[#172033]"
              >
                <option value="none">No reminder</option>
                <option value="0">At time of deadline</option>
                <option value="5">5 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>

            {/* Recurrence */}
            <div>
              <label className="text-xs font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Repeat Schedule</span>
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as SharedTaskRecurrence)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 bg-white text-[#172033]"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {recurrence !== 'none' && (
            <div className="pt-2 border-t border-[#E7EAF0]">
              <Input
                type="date"
                label="Recurrence End Date (Optional)"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7EAF0]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
