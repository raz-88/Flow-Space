import React from 'react';
import type { TaskFilterTab } from '../../types/task';
import { Search, X, Filter } from 'lucide-react';

export interface TaskFiltersProps {
  activeTab: TaskFilterTab;
  onTabChange: (tab: TaskFilterTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedPriority: string;
  onPriorityChange: (priority: string) => void;
  categories: string[];
  counts: {
    all: number;
    today: number;
    upcoming: number;
    overdue: number;
    completed: number;
  };
  onClearFilters: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  categories,
  counts,
  onClearFilters,
}) => {
  const tabs: { id: TaskFilterTab; label: string; count: number; alert?: boolean }[] = [
    { id: 'all', label: 'All Tasks', count: counts.all },
    { id: 'today', label: 'Today', count: counts.today },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'overdue', label: 'Overdue', count: counts.overdue, alert: counts.overdue > 0 },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedPriority !== 'all';

  return (
    <div className="space-y-3.5">
      {/* Primary Tabs */}
      <div className="flex items-center overflow-x-auto pb-1 gap-1 border-b border-[#E7EAF0]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-[2px] flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#635BFF] text-[#635BFF] bg-[#F0EAFE]/40'
                  : 'border-transparent text-[#64748B] hover:text-[#172033] hover:border-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  tab.alert
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isActive
                    ? 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20'
                    : 'bg-slate-100 text-[#64748B]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Secondary Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E7EAF0] shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search tasks by title or notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#F8FAFC] text-[#172033] text-xs placeholder:text-slate-400 border border-[#E7EAF0] rounded-xl pl-8 pr-8 py-2 focus:outline-hidden focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/10 hover:border-slate-300 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] hover:border-slate-300 transition-all cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="text-xs bg-[#F8FAFC] text-[#172033] border border-[#E7EAF0] rounded-xl px-3 py-2 focus:outline-hidden focus:border-[#635BFF] hover:border-slate-300 transition-all cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs font-semibold text-[#635BFF] hover:text-[#5145E5] px-2.5 py-1.5 rounded-xl hover:bg-[#F0EAFE]/40 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Filter className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
