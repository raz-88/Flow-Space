import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../services/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { User, Mail, Lock, Sparkles } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const from = redirectParam || (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    try {
      setLoading(true);
      await register(name.trim(), email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-12 overflow-hidden bg-[#F8FAFC]">
      {/* Soft decorative background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] pointer-events-none -z-10 rounded-full blur-3xl opacity-60"
        style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F0FF 55%, #FFF7ED 100%)',
        }}
      />

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block group mb-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#635BFF] to-[#8B5CF6] text-white font-bold text-xl flex items-center justify-center shadow-[0_4px_14px_0_rgba(99,91,255,0.3)] transition-transform group-hover:scale-105">
              F
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-[#172033] tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-[#64748B] mt-1.5">
            Start organizing your tasks and team workspaces
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E7EAF0] rounded-2xl p-6 sm:p-8 shadow-card">
          {error && (
            <div className="mb-5">
              <Alert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              required
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User className="w-4 h-4" />}
            />

            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-2"
              icon={<Sparkles className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          {/* Footer inside card */}
          <div className="mt-6 pt-5 border-t border-[#E7EAF0] text-center">
            <p className="text-xs text-[#64748B]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-[#635BFF] hover:text-[#5145E5] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
