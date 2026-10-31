import React from 'react';
import { Link } from 'react-router-dom';
import type { Workspace, WorkspaceRole } from '../../types/workspace';
import { Users, ArrowRight, ShieldCheck, Crown, User } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface WorkspaceCardProps {
  workspace: Workspace;
  currentUserRole?: WorkspaceRole;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  currentUserRole = 'member',
}) => {
  const roleBadges: Record<WorkspaceRole, { label: string; variant: 'indigo' | 'warning' | 'neutral'; icon: React.ReactNode }> = {
    owner: {
      label: 'Owner',
      variant: 'indigo',
      icon: <Crown className="w-3 h-3 text-indigo-600" />,
    },
    admin: {
      label: 'Admin',
      variant: 'warning',
      icon: <ShieldCheck className="w-3 h-3 text-amber-600" />,
    },
    member: {
      label: 'Member',
      variant: 'neutral',
      icon: <User className="w-3 h-3 text-slate-500" />,
    },
  };

  const roleInfo = roleBadges[currentUserRole];

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#E7EAF0] shadow-xs hover:shadow-md hover:border-[#635BFF]/35 hover:-translate-y-0.5 transition-all flex flex-col justify-between group relative overflow-hidden">
      {/* Subtle brand top accent bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E7EAF0]">
            {workspace.type || 'General'}
          </span>
          <Badge variant={roleInfo.variant} size="sm" className="flex items-center gap-1">
            {roleInfo.icon}
            <span>{roleInfo.label}</span>
          </Badge>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-[#172033] group-hover:text-[#635BFF] transition-colors tracking-tight mb-2">
          {workspace.name}
        </h3>
        <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2 mb-4">
          {workspace.description || 'No description provided for this workspace.'}
        </p>
      </div>

      {/* Footer Info & Action */}
      <div className="pt-4 border-t border-[#E7EAF0] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#64748B] font-medium">
          <Users className="w-3.5 h-3.5 text-[#635BFF]" />
          <span>{workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}</span>
        </div>

        <Link
          to={`/workspaces/${workspace.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0EAFE] text-[#635BFF] hover:bg-[#E8F0FF] font-semibold transition-all"
        >
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
};

