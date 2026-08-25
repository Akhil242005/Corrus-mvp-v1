'use strict';
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyAuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false); // Default to login for smoother experience
  
  // Registration States
  const [companyName, setCompanyName] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [phone, setPhone] = useState('');
  
  // Shared States (Login & Register)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateInputs = () => {
    if (isRegister) {
      if (!companyName.trim() || !place.trim() || !firstname.trim() || !email.trim() || !password.trim()) {
        setError('Company Name, Place, Admin First Name, Email, and Password are required');
        return false;
      }
      if (phone && !/^[0-9]{10}$/.test(phone.trim())) {
        setError('Phone number must be exactly 10 digits');
        return false;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email and password are required');
        return false;
      }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          place,
          description,
          website,
          firstname,
          lastname,
          email,
          phone,
          password
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register company');
      }

      localStorage.setItem('corrus_company_token', data.token);
      setSuccess('Company registered successfully!');
      
      setTimeout(() => {
        router.push('/company/github-setup');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccess('');
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/company/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      localStorage.setItem('corrus_company_token', data.token);

      if (data.passwordResetRequired) {
        setSuccess('Password reset required. Redirecting to reset page...');
        setTimeout(() => {
          router.push('/company-auth/reset-password');
        }, 1000);
      } else {
        setSuccess('Sign in successful!');
        setTimeout(() => {
          router.push('/company');
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-[540px] bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl p-8 md:p-10 relative z-10 animate-fade-in">
        
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Corrus Logo" className="max-w-[150px] h-auto object-contain filter drop-shadow-sm mb-4" />
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Company Workspace</h2>
          <p className="text-sm text-slate-500 mt-1.5 text-center">Access candidate challenges and manage competence evaluations.</p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-8">
          <button
            onClick={() => { setIsRegister(false); setError(''); setSuccess(''); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${!isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Access Console
          </button>
          <button
            onClick={() => { setIsRegister(true); setError(''); setSuccess(''); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Register Workspace
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-start gap-2.5">
            <span>⚠️</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-xl flex items-start gap-2.5">
            <span>✅</span>
            <span className="leading-snug">{success}</span>
          </div>
        )}

        {/* Form Fields */}
        <div className="flex flex-col gap-5">
          {isRegister ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">🏢 Company Information</span>
                </div>
                
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Company Legal Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">HQ Location *</label>
                      <input
                        type="text"
                        placeholder="City, Country"
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Website URL</label>
                      <input
                        type="text"
                        placeholder="https://example.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Brief Description</label>
                    <textarea
                      placeholder="Describe your core product or engineering team focus."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2.5}
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">👤 Corporate Admin Details</span>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">First Name *</label>
                      <input
                        type="text"
                        placeholder="First name"
                        value={firstname}
                        onChange={(e) => setFirstname(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Last Name</label>
                      <input
                        type="text"
                        placeholder="Last name"
                        value={lastname}
                        onChange={(e) => setLastname(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Mobile Phone (10-digit)</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Corporate Email Address *</label>
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Access Password *</label>
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 mt-4 bg-gradient-to-r from-brand to-brand-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-b-white"></div>
                    Setting up workspace...
                  </>
                ) : (
                  'Create Workspace'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Corporate Email Address</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none glow-input"
                  />
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 mt-4 bg-gradient-to-r from-brand to-brand-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-b-white"></div>
                    Verifying credentials...
                  </>
                ) : (
                  'Access Console'
                )}
              </button>
            </>
          )}
        </div>
        
      </div>
    </div>
  );
}
