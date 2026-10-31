import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToReceivedInvitations } from '../../services/invitationService';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { Button } from './Button';
import { LogOut, ListTodo, Briefcase, Menu, X, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // Listen to pending invitations for badge count
  useEffect(() => {
    if (!currentUser?.email) {
      return;
    }

    const unsub = subscribeToReceivedInvitations(
      currentUser.email,
      (invites) => {
        setPendingInvitesCount(invites.length);
      },
      () => setPendingInvitesCount(0)
    );

    return () => unsub();
  }, [currentUser?.email]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = userProfile?.displayName || currentUser?.displayName || 'User';
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#E7EAF0] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] flex items-center justify-center font-bold text-white text-sm tracking-tight transition-transform group-hover:scale-105 shadow-[0_2px_8px_0_rgba(99,91,255,0.3)]">
            F
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#172033] tracking-tight text-base">
              Flow<span className="text-[#635BFF]">Space</span>
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/15">
              Pro
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1.5">
          <Link
            to="/"
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              isActive('/')
                ? 'bg-[#F0EAFE] text-[#635BFF]'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-slate-100/70'
            }`}
          >
            Overview
          </Link>

          {currentUser && (
            <>
              <Link
                to="/dashboard"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive('/dashboard') || isActive('/tasks')
                    ? 'bg-[#F0EAFE] text-[#635BFF]'
                    : 'text-[#64748B] hover:text-[#172033] hover:bg-slate-100/70'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Planner & Tasks</span>
              </Link>

              <Link
                to="/workspaces"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive('/workspaces')
                    ? 'bg-[#F0EAFE] text-[#635BFF]'
                    : 'text-[#64748B] hover:text-[#172033] hover:bg-slate-100/70'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Workspaces</span>
                {pendingInvitesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] text-white font-bold shadow-xs">
                    {pendingInvitesCount}
                  </span>
                )}
              </Link>
            </>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* In-App Notification Center */}
              <NotificationDropdown />

              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-[#E7EAF0] shadow-xs">
                <div className="w-6 h-6 rounded-full bg-[#F0EAFE] text-[#635BFF] font-bold text-xs flex items-center justify-center border border-[#635BFF]/20">
                  {initial}
                </div>
                <div className="text-left text-xs">
                  <p className="font-semibold text-[#172033] leading-none">{displayName}</p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                loading={loggingOut}
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />}>
                  Get started
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="md:hidden flex items-center gap-2">
          {currentUser && <NotificationDropdown />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#64748B] hover:text-[#172033] rounded-xl hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 bg-white border-b border-[#E7EAF0] space-y-3 shadow-xl">
          <div className="flex flex-col space-y-1.5">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 text-sm font-semibold rounded-xl ${
                isActive('/') ? 'bg-[#F0EAFE] text-[#635BFF]' : 'text-[#64748B] hover:bg-slate-50'
              }`}
            >
              Overview
            </Link>

            {currentUser && (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-sm font-semibold rounded-xl flex items-center justify-between ${
                    isActive('/dashboard')
                      ? 'bg-[#F0EAFE] text-[#635BFF]'
                      : 'text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-[#635BFF]" />
                    <span>Planner & Tasks</span>
                  </span>
                </Link>

                <Link
                  to="/workspaces"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-sm font-semibold rounded-xl flex items-center justify-between ${
                    isActive('/workspaces')
                      ? 'bg-[#F0EAFE] text-[#635BFF]'
                      : 'text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#635BFF]" />
                    <span>Workspaces</span>
                  </span>
                  {pendingInvitesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] text-white">
                      {pendingInvitesCount}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-[#E7EAF0]">
            {currentUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#F0EAFE] text-[#635BFF] font-bold text-sm flex items-center justify-center border border-[#635BFF]/20">
                    {initial}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033]">{displayName}</p>
                    <p className="text-[10px] text-[#64748B]">{currentUser.email}</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  loading={loggingOut}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full">
                    Get started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
