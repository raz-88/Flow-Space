import React, { useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';
import {
  Check,
  Calendar,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle,
  Tag,
  Repeat,
  Bell,
  Clock3,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { snoozeTaskReminder } from '../../services/taskService';

export interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (task: Task, newStatus: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Today's date string in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && task.dueDate < todayStr;
  const isDueToday = !isCompleted && task.dueDate === todayStr;

  const priorityStyles: Record<TaskPriority, { text: string; bg: string; border: string }> = {
    high: {
      text: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200/80',
    },
    medium: {
      text: 'text-[#D97706]',
      bg: 'bg-[#FFF0E5]',
      border: 'border-[#D97706]/20',
    },
    low: {
      text: 'text-[#64748B]',
      bg: 'bg-slate-100',
      border: 'border-[#E7EAF0]',
    },
  };

  const formattedDate = () => {
    if (!task.dueDate) return null;
    const parts = task.dueDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return task.dueDate;
  };

  const handleSnooze = async (minutes: number) => {
    setMenuOpen(false);
    try {
      await snoozeTaskReminder(task.userId, task.id, minutes);
    } catch (err) {
      console.warn('Failed to snooze task:', err);
    }
  };

  return (
    <div
      className={`group relative p-4 sm:p-5 rounded-2xl bg-white border transition-all duration-200 ${
        isCompleted
          ? 'border-[#E7EAF0]/60 bg-slate-50/40 opacity-75'
          : isOverdue
          ? 'border-rose-200 bg-[#FFF0E5]/15 hover:border-rose-300 shadow-xs'
          : 'border-[#E7EAF0] hover:border-[#635BFF]/30 hover:shadow-card shadow-subtle'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Completion Checkbox */}
        <button
          onClick={() => onToggleComplete(task)}
          className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isCompleted
              ? 'bg-[#059669] border-[#059669] text-white shadow-xs'
              : 'border-slate-300 hover:border-[#635BFF] hover:bg-[#F0EAFE]/40'
          }`}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark completed'}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        {/* Task Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={`text-sm font-semibold tracking-tight break-words ${
                isCompleted ? 'line-through text-slate-400 font-normal' : 'text-[#172033]'
              }`}
            >
              {task.title}
            </h4>

            {/* Actions Menu Trigger */}
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-slate-400 hover:text-[#172033] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Task actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E7EAF0] rounded-2xl shadow-xl py-1.5 z-30 text-xs divide-y divide-[#E7EAF0]/70 animate-in fade-in-50 zoom-in-95">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(task);
                        }}
                        className="w-full px-3.5 py-1.5 text-left text-[#172033] hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Task</span>
                      </button>
                    </div>

                    {!isCompleted && (
                      <div className="py-1">
                        <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Snooze Alert
                        </div>
                        <button
                          onClick={() => handleSnooze(15)}
                          className="w-full px-3.5 py-1 text-left text-[#172033] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Clock3 className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>+15 Minutes</span>
                        </button>
                        <button
                          onClick={() => handleSnooze(60)}
                          className="w-full px-3.5 py-1 text-left text-[#172033] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Clock3 className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>+1 Hour</span>
                        </button>
                      </div>
                    )}

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(task.id);
                        }}
                        className="w-full px-3.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <p
              className={`text-xs mt-1 leading-relaxed ${
                isCompleted ? 'text-slate-400 line-through' : 'text-[#64748B]'
              }`}
            >
              {task.description}
            </p>
          )}

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#E7EAF0]/80 text-xs">
            {/* Category */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#172033] font-medium text-[11px] border border-[#E7EAF0]">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>{task.category}</span>
            </span>

            {/* Priority */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium text-[11px] border capitalize ${
                priorityStyles[task.priority].bg
              } ${priorityStyles[task.priority].text} ${priorityStyles[task.priority].border}`}
            >
              {task.priority} Priority
            </span>

            {/* Recurrence Indicator */}
            {task.recurrence && task.recurrence !== 'none' && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0EAFE] text-[#635BFF] font-medium text-[11px] border border-[#635BFF]/20"
                title={`Repeats ${task.recurrence}`}
              >
                <Repeat className="w-3 h-3 text-[#635BFF]" />
                <span className="capitalize">{task.recurrence}</span>
              </span>
            )}

            {/* Reminder Indicator */}
            {task.reminderMinutes !== null && task.reminderMinutes !== undefined && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF0E5] text-[#D97706] font-medium text-[11px] border border-[#D97706]/20"
                title={`Reminder set: ${task.reminderMinutes} mins before`}
              >
                <Bell className="w-3 h-3 text-[#D97706]" />
                <span>
                  {task.reminderMinutes === 0
                    ? 'At time'
                    : task.reminderMinutes >= 1440
                    ? '1d before'
                    : task.reminderMinutes >= 60
                    ? `${task.reminderMinutes / 60}h before`
                    : `${task.reminderMinutes}m before`}
                </span>
              </span>
            )}

            {/* Status Selector */}
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}
              className="text-[11px] font-medium bg-[#F8FAFC] border border-[#E7EAF0] rounded-lg px-2 py-0.5 text-[#172033] hover:border-slate-300 focus:outline-hidden focus:border-[#635BFF] cursor-pointer"
              title="Update status"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            {/* Due Date & Time */}
            {task.dueDate && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue
                    ? 'text-rose-600 font-semibold'
                    : isDueToday
                    ? 'text-[#635BFF] font-semibold'
                    : 'text-[#64748B]'
                }`}
              >
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{formattedDate()}</span>
                {task.dueTime && (
                  <span className="flex items-center gap-0.5 ml-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{task.dueTime}</span>
                  </span>
                )}
              </span>
            )}

            {/* Overdue alert */}
            {isOverdue && (
              <Badge variant="rose" size="sm">
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
        </div>
      </div>
    </div>
  );
};
