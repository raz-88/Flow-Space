import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  Briefcase,
  MessageSquare,
  Bell,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const WelcomePage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#172033]">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Soft welcome gradient ambient glow in background */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[520px] pointer-events-none -z-10 rounded-b-3xl opacity-90"
          style={{
            background:
              'linear-gradient(135deg, #EEF2FF 0%, #F5F0FF 55%, #FFF7ED 100%)',
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-[#E7EAF0] shadow-xs text-xs font-medium text-[#172033] mb-8 backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-[#635BFF] animate-pulse" />
            <span className="text-[#64748B]">Introducing FlowSpace 1.0</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-[#635BFF] font-semibold flex items-center gap-1">
              Personal Planner & Workspaces
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#172033] mb-6 leading-[1.08]">
            Your work. Your team.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#635BFF] to-[#8B5CF6]">
              One clear flow.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-[#64748B] max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Plan your day, organize your projects, and bring your team together in one simple,
            distraction-free workspace.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-14">
            {currentUser ? (
              <Link to="/dashboard">
                <Button size="lg" icon={<ArrowRight className="w-4 h-4" />}>
                  Go to Your Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" icon={<Sparkles className="w-4 h-4" />}>
                    Get Started Free
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" size="lg">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Interactive Visual Preview / Mockup Card */}
          <div className="max-w-4xl mx-auto rounded-3xl p-3 sm:p-5 bg-white/80 border border-[#E7EAF0] shadow-[0_20px_50px_-10px_rgba(99,91,255,0.12)] backdrop-blur-md">
            <div className="rounded-2xl border border-[#E7EAF0] bg-white overflow-hidden text-left shadow-xs">
              {/* Mockup Header Bar */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-white to-[#F0EAFE]/20 border-b border-[#E7EAF0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-[#172033] ml-2">
                    FlowSpace Productivity Center
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="indigo" size="sm">
                    Synced & Live
                  </Badge>
                </div>
              </div>

              {/* Mockup Content Grid */}
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#F8FAFC]/50">
                {/* Column 1: Personal Planner Widget */}
                <div className="p-4 rounded-xl bg-white border border-[#E7EAF0] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#172033]">
                      <Calendar className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>Today's Focus</span>
                    </div>
                    <Badge variant="indigo" size="sm">
                      3 items
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#E2F8EE]/60 border border-[#059669]/15 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="line-through text-slate-400 font-medium">
                          Review design system tokens
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E7EAF0] flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                        <span className="font-semibold text-[#172033]">
                          Ship team workspace release
                        </span>
                      </div>
                      <Badge variant="peach" size="sm">
                        High
                      </Badge>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E7EAF0] flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                        <span className="text-[#172033] font-medium">
                          Sync with engineering leads
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">14:00</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Team Workspace Widget */}
                <div className="p-4 rounded-xl bg-white border border-[#E7EAF0] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#172033]">
                      <Briefcase className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Product Team Space</span>
                    </div>
                    <div className="flex -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#F0EAFE] text-[#635BFF] border border-white text-[9px] font-bold flex items-center justify-center">
                        A
                      </div>
                      <div className="w-5 h-5 rounded-full bg-[#E8F0FF] text-[#2563EB] border border-white text-[9px] font-bold flex items-center justify-center">
                        M
                      </div>
                      <div className="w-5 h-5 rounded-full bg-[#E2F8EE] text-[#059669] border border-white text-[9px] font-bold flex items-center justify-center">
                        S
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50/70 border border-[#E7EAF0]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#172033]">Sprint Completion</span>
                        <span className="text-[11px] font-bold text-[#635BFF]">78%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] w-[78%]" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F0EAFE]/40 border border-[#635BFF]/15 flex items-center justify-between">
                      <span className="font-medium text-[#172033]">Assigned: Architecture doc</span>
                      <span className="text-[10px] text-[#635BFF] font-semibold">Today</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Collaboration & Notifications Widget */}
                <div className="p-4 rounded-xl bg-white border border-[#E7EAF0] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#172033]">
                      <Bell className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Live Updates</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E7EAF0] flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#172033] text-[11px]">
                          Sarah commented on task
                        </p>
                        <p className="text-[10px] text-[#64748B]">"Added the updated Figma specs."</p>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E7EAF0] flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#172033] text-[11px]">
                          Task completed by Alex
                        </p>
                        <p className="text-[10px] text-[#64748B]">Updated 4m ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid Section */}
      <section className="py-16 md:py-24 bg-white border-y border-[#E7EAF0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033] mb-3">
              Designed for focus. Built for teams.
            </h2>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Every tool in FlowSpace is crafted to keep your day organized, your deadlines clear,
              and your teammates aligned.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1: Personal Planner */}
            <div className="p-6 rounded-2xl bg-[#F0EAFE]/50 border border-[#635BFF]/15 transition-all duration-200 hover:shadow-card hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-white text-[#635BFF] flex items-center justify-center mb-4 shadow-xs border border-[#635BFF]/15">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033] mb-1.5">Personal Planner</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Organize your day with flexible categories, recurring habits, priority levels, and
                instant filtering.
              </p>
            </div>

            {/* Feature 2: Team Workspaces */}
            <div className="p-6 rounded-2xl bg-[#E8F0FF]/60 border border-[#2563EB]/15 transition-all duration-200 hover:shadow-card hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-white text-[#2563EB] flex items-center justify-center mb-4 shadow-xs border border-[#2563EB]/15">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033] mb-1.5">Team Workspaces</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Create dedicated collaborative hubs for projects with shared task assignments, member
                roles, and invites.
              </p>
            </div>

            {/* Feature 3: Live Discussion */}
            <div className="p-6 rounded-2xl bg-[#E2F8EE]/60 border border-[#059669]/15 transition-all duration-200 hover:shadow-card hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-white text-[#059669] flex items-center justify-center mb-4 shadow-xs border border-[#059669]/15">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033] mb-1.5">Task Collaboration</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Discuss tasks in real-time, share updates, and notify teammates without endless
                meeting overhead.
              </p>
            </div>

            {/* Feature 4: Smart Reminders */}
            <div className="p-6 rounded-2xl bg-[#FFF0E5]/60 border border-[#D97706]/15 transition-all duration-200 hover:shadow-card hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-white text-[#D97706] flex items-center justify-center mb-4 shadow-xs border border-[#D97706]/15">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033] mb-1.5">Reminders & Snooze</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Stay on top of deadlines with in-app reminders, snooze controls, and clear overdue
                notifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Simplicity Section */}
      <section className="py-16 md:py-20 bg-[#F8FAFC]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-white via-[#F0EAFE]/30 to-white border border-[#E7EAF0] shadow-card">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight mb-3">
              Ready to find your flow?
            </h2>
            <p className="text-sm text-[#64748B] max-w-xl mx-auto mb-6 leading-relaxed">
              Join students, makers, and teams who use FlowSpace everyday to stay focused and get
              things done.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/register">
                <Button size="lg" icon={<ArrowRight className="w-4 h-4" />}>
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
