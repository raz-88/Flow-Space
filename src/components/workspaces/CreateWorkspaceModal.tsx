import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; type?: string }) => Promise<void>;
}

export const WORKSPACE_TYPES = [
  'General',
  'Engineering',
  'Design',
  'Product',
  'Operations',
  'Marketing',
];

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a workspace name.');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type,
      });
      setName('');
      setDescription('');
      setType('General');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Team Workspace"
      description="Set up a shared environment for projects, tasks, and team collaboration"
      maxWidth="md"
    >
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Workspace Name"
          required
          placeholder="e.g., Core Engineering, Growth Team, Design Ops"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="space-y-1.5 text-left">
          <label
            htmlFor="workspace-desc"
            className="block text-xs font-semibold text-[#172033] tracking-wide"
          >
            Description (Optional)
          </label>
          <textarea
            id="workspace-desc"
            rows={2}
            placeholder="Brief overview of the workspace's scope or purpose..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white text-[#172033] text-sm placeholder:text-[#64748B] border border-[#E7EAF0] focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15 hover:border-slate-300 rounded-xl p-3 transition-all duration-150 focus:outline-hidden"
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-[#172033] tracking-wide">
            Workspace Type
          </label>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  type === t
                    ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/30 shadow-xs font-semibold'
                    : 'bg-white text-[#64748B] border border-[#E7EAF0] hover:bg-[#F8FAFC] hover:text-[#172033]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E7EAF0]">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
};

