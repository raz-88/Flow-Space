import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mapAuthError } from '../services/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Mail, ArrowLeft, Send } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide your account email address.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email.trim());
      setSubmitted(true);
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
            Reset your password
          </h1>
          <p className="text-xs text-[#64748B] mt-1.5">
            We will send a secure recovery link to your email
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E7EAF0] rounded-2xl p-6 sm:p-8 shadow-card">
          {error && (
            <div className="mb-5">
              <Alert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          {submitted ? (
            <div className="space-y-4 text-center py-2">
              <Alert
                type="success"
                title="Recovery email sent"
                message={`If an account exists for ${email}, a password reset link has been dispatched.`}
              />
              <p className="text-xs text-[#64748B] leading-relaxed pt-2">
                Please check your inbox (and spam folder). The link will expire in 1 hour.
              </p>
              <Link to="/login" className="block pt-2">
                <Button variant="secondary" size="md" className="w-full">
                  Return to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Account Email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                helperText="Enter the email associated with your FlowSpace account."
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                className="w-full mt-2"
                icon={<Send className="w-4 h-4" />}
              >
                Send Reset Link
              </Button>
            </form>
          )}

          {/* Footer inside card */}
          <div className="mt-6 pt-5 border-t border-[#E7EAF0] text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#172033] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
