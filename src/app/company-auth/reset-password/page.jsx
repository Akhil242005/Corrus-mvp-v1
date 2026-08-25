'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  
  // Auth state
  const [token, setToken] = useState('');
  
  // UI states
  const [step, setStep] = useState(1); // 1 = Request OTP, 2 = Enter OTP + New Password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('corrus_company_token');
    if (!storedToken) {
      router.push('/');
      return;
    }
    setToken(storedToken);
  }, []);

  const handleRequestOtp = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/company/request-password-reset-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request code');
      }

      setSuccess('A verification code has been dispatched to your corporate email (valid for 10 minutes).');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Something went wrong while sending the OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (otpCode.length !== 6 || isNaN(Number(otpCode))) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }
    if (!newPassword) {
      setError('Please enter your new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/company/confirm-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          otpCode: otpCode.trim(),
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      localStorage.setItem('corrus_company_token', data.token);
      setSuccess('Password updated successfully! Redirecting to corporate dashboard...');
      
      setTimeout(() => {
        router.push('/company');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Verification failed. Please double-check your code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative Blur Layers */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-brand-accent/10 blur-[130px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-8 relative z-10 animate-fade-in transition duration-300">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert mb-4" />
          <h2 className="text-xl font-black text-white tracking-wide uppercase">Secure Your Account</h2>
          <p className="text-xs font-semibold text-slate-400 mt-2 max-w-[320px] leading-relaxed">
            As a newly registered employee, you must update your temporary credentials to establish secure access to the corporate workspace.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-brand-accent' : 'w-2 bg-slate-700'}`}></div>
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-brand-accent' : 'w-2 bg-slate-700'}`}></div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs font-bold rounded-xl flex items-start gap-2.5">
            <span>⚠️</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs font-bold rounded-xl flex items-start gap-2.5">
            <span>✅</span>
            <span className="leading-snug">{success}</span>
          </div>
        )}

        {/* Flow Switcher */}
        {step === 1 ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-xs text-slate-300 leading-relaxed max-w-[340px] mx-auto">
              We will send a 6-digit confirmation code directly to your corporate inbox. Ensure you can access your email to receive it.
            </p>
            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-accent to-brand text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-brand-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-b-white"></div>
                  Generating Code...
                </>
              ) : (
                '📩 Send Verification Code'
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleConfirmReset} className="flex flex-col gap-5">
            
            {/* OTP Input */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Verification Code (OTP) *</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-brand-accent font-mono text-center tracking-widest text-lg outline-none glow-input-dark"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">New Access Password *</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white outline-none glow-input-dark"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Confirm New Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white outline-none glow-input-dark"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-brand-accent to-brand text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-brand-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-b-white"></div>
                  Resetting Password...
                </>
              ) : (
                '🔑 Confirm & Access Dashboard'
              )}
            </button>
          </form>
        )}

        {/* Back navigation */}
        <div className="mt-8 text-center border-t border-slate-800/60 pt-5">
          <button
            onClick={() => {
              localStorage.removeItem('corrus_company_token');
              router.push('/company-auth');
            }}
            className="text-xs font-bold text-slate-500 hover:text-white transition duration-150 cursor-pointer"
          >
            ← Back to Login
          </button>
        </div>
        
      </div>
    </div>
  );
}
