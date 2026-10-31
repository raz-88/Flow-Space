import React, { useState, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, TaskStatus, TaskRecurrence } from '../../types/task';
import { DEFAULT_CATEGORIES } from '../../types/task';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Plus, Bell, Repeat } from 'lucide-react';

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: TaskFormData) => Promise<void>;
  taskToEdit?: Task | null;
  existingCategories: string[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  taskToEdit,
  existingCategories,
}) => {
  const isEditing = Boolean(taskToEdit);
  const defaultDueDate = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [dueTime, setDueTime] = useState('');
  const [category, setCategory] = useState<string>('Personal');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [reminderMinutes, setReminderMinutes] = useState<string>('none');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combine default categories with unique existing categories
  const allCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...existingCategories.filter(Boolean)])
  );

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority || 'medium');
      setDueDate(taskToEdit.dueDate || defaultDueDate);
      setDueTime(taskToEdit.dueTime || '');
      setStatus(taskToEdit.status || 'pending');
      setReminderMinutes(
        taskToEdit.reminderMinutes !== undefined && taskToEdit.reminderMinutes !== null
          ? String(taskToEdit.reminderMinutes)
          : 'none'
      );
      setRecurrence(taskToEdit.recurrence || 'none');
      setRecurrenceEndDate(taskToEdit.recurrenceEndDate || '');

      if (allCategories.includes(taskToEdit.category as (typeof DEFAULT_CATEGORIES)[number])) {
        setCategory(taskToEdit.category);
        setIsCustomCategory(false);
        setCustomCategoryInput('');
      } else {
        setIsCustomCategory(true);
        setCustomCategoryInput(taskToEdit.category || '');
      }
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate(defaultDueDate);
      setDueTime('');
      setCategory('Personal');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setStatus('pending');
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

    const resolvedCategory = isCustomCategory
      ? customCategoryInput.trim() || 'General'
      : category;

    try {
      setLoading(true);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate,
        dueTime: dueTime.trim(),
        category: resolvedCategory,
        status,
        reminderMinutes: reminderMinutes === 'none' ? null : Number(reminderMinutes),
        recurrence,
        recurrenceEndDate: recurrenceEndDate || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Create New Task'}
      description={
        isEditing
          ? 'Update the details of your personal task'
          : 'Add a new task to your personal planner'
      }
      maxWidth="md"
    >
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <Input
          label="Task Title"
          required
          placeholder="e.g., Complete Chapter 3 Notes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Add relevant notes, links, or instructions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-[#E7EAF0] bg-white px-3.5 py-2.5 text-sm text-[#172033] placeholder:text-[#64748B] focus:border-[#635BFF] focus:outline-hidden focus:ring-2 focus:ring-[#635BFF]/15 transition-all resize-none"
          />
        </div>

        {/* Priority Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
            Priority
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
              const isSelected = priority === p;
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer ${
                    isSelected
                      ? p === 'high'
                        ? 'border-rose-300 bg-[#FFF0E5] text-rose-700 shadow-xs ring-1 ring-rose-400/30'
                        : p === 'medium'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-xs ring-1 ring-amber-400/30'
                        : 'border-slate-300 bg-slate-100 text-slate-800 shadow-xs ring-1 ring-slate-400/20'
                      : 'border-[#E7EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Due Date & Optional Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label="Due Date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>Reminder Alert</span>
              </label>
              <select
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] bg-white text-[#172033] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 transition-all"
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

            <div>
              <label className="text-xs font-medium text-[#172033] mb-1.5 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Repeat Schedule</span>
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] bg-white text-[#172033] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 transition-all"
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

        {/* Category Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
            Category
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {allCategories.map((cat) => {
              const isSelected = !isCustomCategory && category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setIsCustomCategory(false);
                  }}
                  className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#635BFF] bg-[#F0EAFE] text-[#635BFF] font-semibold shadow-xs'
                      : 'border-[#E7EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsCustomCategory(true)}
              className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
                isCustomCategory
                  ? 'border-[#635BFF] bg-[#F0EAFE] text-[#635BFF] font-semibold shadow-xs'
                  : 'border-dashed border-[#E7EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom</span>
            </button>
          </div>

          {isCustomCategory && (
            <Input
              label="Custom Category Name"
              placeholder="e.g., Coding, Fitness..."
              value={customCategoryInput}
              onChange={(e) => setCustomCategoryInput(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Status (For Editing) */}
        {isEditing && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#172033] mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border capitalize transition-all cursor-pointer ${
                    status === s
                      ? s === 'completed'
                        ? 'border-emerald-300 bg-[#E2F8EE] text-emerald-800 font-semibold ring-1 ring-emerald-400/30'
                        : s === 'in_progress'
                        ? 'border-blue-300 bg-[#E8F0FF] text-blue-800 font-semibold ring-1 ring-blue-400/30'
                        : 'border-slate-300 bg-slate-100 text-slate-800 font-semibold ring-1 ring-slate-400/20'
                      : 'border-[#E7EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
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
