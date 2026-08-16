'use strict';
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyAuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(true);
  
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

      localStorage.setItem('token', data.token);
      setSuccess('Company registered successfully!');
      
      setTimeout(() => {
        router.push('/company');
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

      localStorage.setItem('token', data.token);
      setSuccess('Sign in successful!');
      
      setTimeout(() => {
        router.push('/company');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-[500px] bg-white border border-slate-200 rounded-xl shadow-xl p-8">
        {/* Brand Header */}
        <div className="mb-6 flex justify-center">
          <img src="/logo.png" alt="Corrus Logo" className="max-w-[180px] h-auto object-contain filter drop-shadow-md" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          {isRegister ? 'Register your Company' : 'Company Workspace Login'}
        </h2>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          {isRegister ? (
            <>
              <p className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                🏢 Enterprise Information
              </p>
              <input
                type="text"
                placeholder="Company Legal Name *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="text"
                placeholder="Headquarters Location (City, Country) *"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="text"
                placeholder="Website URL (https://example.com)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <textarea
                placeholder="Brief Company Overview / Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />

              <p className="text-sm font-bold text-slate-900 border-b border-slate-100 pt-2 pb-2">
                🔑 Corporate Admin Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name *"
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
              </div>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="email"
                placeholder="corporate.email@company.com *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="password"
                placeholder="Access Password *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? 'Registering Enterprise...' : 'Create Company Workspace'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                🔒 Enterprise Sign In
              </p>
              <input
                type="email"
                placeholder="corporate.email@company.com"
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
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? 'Signing in...' : 'Access Workspace'}
              </button>
            </>
          )}
        </div>

        {/* Toggle Mode */}
        <p className="mt-6 text-sm text-center text-slate-500">
          <span>{isRegister ? 'Already registered your company? ' : 'Need a company workspace? '}</span>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setSuccess('');
            }}
            className="font-semibold text-brand hover:underline cursor-pointer"
          >
            {isRegister ? 'Workspace Login' : 'Register Workspace'}
          </button>
        </p>

        {/* Feedback Messages */}
        {error && <p className="mt-4 text-sm font-semibold text-rose-500 text-center">{error}</p>}
        {success && <p className="mt-4 text-sm font-semibold text-emerald-500 text-center">{success}</p>}
      </div>
    </div>
  );
}
