'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Check query parameters for error messages from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(err);
    }
  }, []);

  const handleToggle = (e) => {
    e.preventDefault();
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
  };

  const validateInputs = () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!isLogin) {
      if (!firstname.trim()) {
        setError('First name is required');
        return false;
      }
      if (phone && !/^[0-9]{10}$/.test(phone.trim())) {
        setError('Phone number must be exactly 10 digits');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (!validateInputs()) return;

    setLoading(false);
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const payload = isLogin
        ? { email, password }
        : { firstname, lastname, phone, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      localStorage.setItem('token', data.token);
      setSuccess(isLogin ? 'Login successful!' : 'Account registered successfully!');
      
      // Verification call to resolve landing redirection
      const verifyRes = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const verifyData = await verifyRes.json();
      
      if (verifyRes.ok && verifyData.user) {
        const { role } = verifyData.user;
        if (role === 'admin') {
          router.push('/admin');
        } else if (role === 'company_admin' || role === 'company_employee') {
          router.push('/company');
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-[460px] bg-white border border-slate-200 rounded-xl shadow-xl p-8 flex flex-col items-center">
        {/* Brand Header */}
        <div className="mb-6 flex justify-center">
          <img src="/logo.png" alt="Corrus Logo" className="max-w-[180px] h-auto object-contain filter drop-shadow-md" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          {isLogin ? 'Welcome Back!' : 'Create Candidate Account'}
        </h2>

        {/* Social Authentication Links */}
        <div className="w-full flex flex-col gap-3 mb-6">
          <a
            href="/auth/google"
            className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-lg bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition duration-150"
          >
            <img src="/google.jpg" alt="Google Logo" className="w-5 h-5 object-contain" />
            <span>Continue with Google</span>
          </a>
          <a
            href="/auth/github"
            className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-lg bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition duration-150"
          >
            <img src="/github.webp" alt="GitHub Logo" className="w-5 h-5 object-contain" />
            <span>Continue with GitHub</span>
          </a>
        </div>

        {/* Separator */}
        <div className="w-full flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="text-xs text-slate-400 font-semibold uppercase">or</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        {/* Form Inputs */}
        <div className="w-full flex flex-col gap-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="First Name"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="tel"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
            </>
          )}

          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

        {/* Toggle Mode */}
        <p className="mt-6 text-sm text-slate-500">
          <span>{isLogin ? "Don't have an account? " : 'Already have an account? '}</span>
          <a href="#" onClick={handleToggle} className="font-semibold text-brand hover:underline">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </a>
        </p>

        {/* Feedback Messages */}
        {error && <p className="mt-4 text-sm font-semibold text-rose-500 text-center">{error}</p>}
        {success && <p className="mt-4 text-sm font-semibold text-emerald-500 text-center">{success}</p>}


      </div>
    </div>
  );
}
