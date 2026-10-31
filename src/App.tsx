import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/ui/Navbar';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { WorkspaceDetailPage } from './pages/WorkspaceDetailPage';
import { JoinWorkspacePage } from './pages/JoinWorkspacePage';
import { useTaskReminders } from './hooks/useTaskReminders';

function AppContent() {
  // In-app task reminders and deadline watcher
  useTaskReminders();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public landing / welcome page */}
          <Route path="/" element={<WelcomePage />} />

          {/* Public join routes (accessible by guests and logged-in users) */}
          <Route path="/join-workspace" element={<JoinWorkspacePage />} />
          <Route path="/join" element={<JoinWorkspacePage />} />

          {/* Guest only routes (redirect to /dashboard if logged in) */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Protected member routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<DashboardPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Minimal SaaS Footer */}
      <footer className="border-t border-slate-200/80 py-6 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">FlowSpace</span>
            <span>&bull;</span>
            <span>Productivity & Team Collaboration Platform</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>React 19</span>
            <span>&bull;</span>
            <span>TypeScript</span>
            <span>&bull;</span>
            <span>Tailwind CSS</span>
            <span>&bull;</span>
            <span>Firebase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
