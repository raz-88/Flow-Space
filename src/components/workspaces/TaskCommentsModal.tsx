import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToTaskComments,
  addTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from '../../services/commentService';
import type { SharedTask, Workspace, TaskComment } from '../../types/workspace';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Calendar,
  UserCheck,
} from 'lucide-react';

export interface TaskCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: SharedTask | null;
  workspace: Workspace | null;
  canModerate: boolean;
}

export const TaskCommentsModal: React.FC<TaskCommentsModalProps> = ({
  isOpen,
  onClose,
  task,
  workspace,
  canModerate,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New comment input
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Editing comment
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [updating, setUpdating] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to comments
  useEffect(() => {
    if (!isOpen || !workspace?.id || !task?.id) {
      setComments([]);
      return;
    }

    setLoading(true);
    const unsub = subscribeToTaskComments(
      workspace.id,
      task.id,
      (data) => {
        setComments(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Failed to load task comments.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [isOpen, workspace?.id, task?.id]);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !workspace || !task || !currentUser) return;

    try {
      setSubmitting(true);
      setError(null);
      await addTaskComment(
        workspace.id,
        task.id,
        task.title,
        workspace.name,
        {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName || 'Member',
          email: currentUser.email || undefined,
        },
        newComment.trim(),
        {
          assignedToUid: task.assignedToUid,
          createdByUid: task.createdByUid,
        }
      );
      setNewComment('');
    } catch (err) {
      console.error(err);
      setError('Could not post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (c: TaskComment) => {
    setEditingCommentId(c.id);
    setEditContent(c.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!workspace || !task || !editContent.trim()) return;

    try {
      setUpdating(true);
      await updateTaskComment(workspace.id, task.id, commentId, editContent.trim());
      setEditingCommentId(null);
    } catch (err) {
      console.error(err);
      setError('Failed to update comment.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!workspace || !task || !currentUser) return;
    try {
      await deleteTaskComment(
        workspace.id,
        task.id,
        commentId,
        task.title,
        {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName || 'Member',
        }
      );
    } catch (err) {
      console.error(err);
      setError('Failed to delete comment.');
    }
  };

  const formatTimestamp = (createdAt: TaskComment['createdAt']) => {
    if (!createdAt) return 'Just now';
    const seconds = (createdAt as { seconds?: number })?.seconds;
    if (!seconds) return 'Just now';

    const date = new Date(seconds * 1000);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Discussion & Activity"
      description={`Collaborative comments for "${task.title}"`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Task Summary Banner */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#172033]">{task.title}</span>
            <Badge
              variant={
                task.priority === 'high' || task.priority === 'medium'
                  ? 'warning'
                  : 'neutral'
              }
              size="sm"
            >
              {task.priority.toUpperCase()}
            </Badge>
            <Badge
              variant={task.status === 'completed' ? 'mint' : 'neutral'}
              size="sm"
            >
              {task.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-[#64748B]">
            {task.assignedToName && (
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>{task.assignedToName}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{task.dueDate}</span>
            </span>
          </div>
        </div>

        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} />
        )}

        {/* Comment Stream */}
        <div className="min-h-56 max-h-80 overflow-y-auto space-y-3 p-3 rounded-xl border border-[#E7EAF0] bg-white">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#F0EAFE] text-[#635BFF] mx-auto flex items-center justify-center mb-2">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-[#172033]">No comments yet</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Start the discussion with your team on this task.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const isAuthor = currentUser?.uid === comment.authorUid;
              const canDelete = isAuthor || canModerate;
              const isEditingThis = editingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E7EAF0] transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-[#172033]">
                        {comment.authorName}
                      </span>
                      {isAuthor && (
                        <span className="text-[10px] bg-[#F0EAFE] text-[#635BFF] px-1.5 py-0.2 rounded font-mono font-semibold">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#64748B]">
                        {formatTimestamp(comment.createdAt)}
                      </span>

                      {!isEditingThis && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          {isAuthor && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(comment)}
                              className="p-1 text-[#64748B] hover:text-[#635BFF] rounded cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 text-[#64748B] hover:text-rose-600 rounded cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditingThis ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 bg-white text-[#172033]"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCommentId(null)}
                          disabled={updating}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          loading={updating}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#172033] whitespace-pre-wrap leading-relaxed pl-8">
                      {comment.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* New Comment Input */}
        <form onSubmit={handleAddComment} className="pt-2">
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Leave a comment or mention an update..."
              className="w-full text-xs p-3 pr-24 rounded-xl border border-[#E7EAF0] focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 resize-none min-h-[72px] bg-white text-[#172033] placeholder:text-[#64748B] transition-all"
              disabled={submitting}
            />
            <div className="absolute right-2.5 bottom-3.5">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newComment.trim() || submitting}
                loading={submitting}
                className="gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>Post</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
