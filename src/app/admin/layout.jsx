'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCanonicalId } from '@/lib/idMapper';
import Link from 'next/link';

export const AdminContext = createContext(null);

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // Admin Data states
  const [token, setToken] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminUser, setAdminUser] = useState(null);

  // Admin Auth States
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Sign Up States
  const [regFirstname, setRegFirstname] = useState('');
  const [regLastname, setRegLastname] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSecurityKey, setRegSecurityKey] = useState('');

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  // Initialize and check admin access
  useEffect(() => {
    const storedToken = localStorage.getItem('corrus_admin_token');
    const storedSidebar = localStorage.getItem('corrus_admin_sidebar_open');
    
    if (storedSidebar !== null) {
      setIsSidebarOpen(storedSidebar === 'true');
    }
    
    if (!storedToken) {
      setIsAuthorized(false);
      setCheckingAuth(false);
      return;
    }

    // Decode token and verify role client-side
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      const role = payload.role;
      if (role !== 'admin') {
        if (pathname !== '/admin') {
          if (role === 'company_admin' || role === 'company_employee') {
            router.push('/company');
          } else {
            router.push('/dashboard');
          }
          return;
        } else {
          setIsAuthorized(false);
          setCheckingAuth(false);
          return;
        }
      } else {
        // If they are an admin and are at '/admin', redirect to verification sub-route immediately
        if (pathname === '/admin') {
          router.replace('/admin/verification');
        }
      }
    } catch (e) {
      setIsAuthorized(false);
      setCheckingAuth(false);
      return;
    }

    setToken(storedToken);
    fetchData(storedToken);
  }, []);

  const fetchData = async (jwtToken) => {
    try {
      const dirRes = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (!dirRes.ok) {
        logout();
        return;
      }
      const dirData = await dirRes.json();
      setUsers(dirData.users || []);
      setEmployees(dirData.employees || []);
      setCompanies(dirData.companies || []);
      setCompetitions(dirData.competitions || []);

      const logsRes = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (logsRes.ok) {
        const logs = await logsRes.json();
        setAuditLogs(logs || []);
      }

      // Load profile info from token/profile (mock check or decode token)
      // Since it's admin, we can fetch their profile
      const profileRes = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (profileRes.ok) {
        const pData = await profileRes.json();
        setAdminUser(pData);
      }

      setIsAuthorized(true);
    } catch (err) {
      if (err.message !== 'Unauthorized or failed to fetch directories') {
        console.error('Directory Fetch Error:', err);
      }
      logout();
    } finally {
      setCheckingAuth(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('corrus_admin_token');
    setToken('');
    setIsAuthorized(false);
    setAdminUser(null);
    router.push('/admin');
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Email and password are required');
      setLoginLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('corrus_admin_token', data.token);
      setToken(data.token);
      await fetchData(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    if (!regFirstname.trim() || !loginEmail.trim() || !loginPassword.trim() || !regSecurityKey.trim()) {
      setLoginError('First name, email, password, and security key are required');
      setLoginLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: regFirstname,
          lastname: regLastname,
          email: loginEmail,
          phone: regPhone,
          password: loginPassword,
          securityKey: regSecurityKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem('corrus_admin_token', data.token);
      setToken(data.token);
      await fetchData(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const toggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem('corrus_admin_sidebar_open', String(nextState));
  };

  // Toggle company verification
  const handleVerifyCompany = async (compId, isVerified) => {
    try {
      const res = await fetch(`/api/admin/companies/${compId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isVerified })
      });
      const data = await res.json();
      if (res.ok) {
        fetchData(token);
      } else {
        alert(data.error || 'Failed to update company verification status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle user role
  const handleChangeRole = async (userId, currentRole) => {
    const targetRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: targetRole })
      });
      const data = await res.json();
      if (res.ok) {
        fetchData(token);
      } else {
        alert(data.error || 'Failed to update role');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Soft delete user
  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchData(token);
      } else {
        alert(data.error || 'Failed to deactivate user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Soft delete competition
  const handleDeleteCompetition = async (compId) => {
    try {
      const res = await fetch(`/api/admin/competitions/${compId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchData(token);
      } else {
        alert(data.error || 'Failed to delete competition');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auth screen guard
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
        <p className="text-slate-500 font-semibold text-sm">Verifying administrator session...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
        <div className="w-full max-w-[460px] bg-white border border-slate-200 rounded-xl shadow-xl p-8 flex flex-col items-center">
          <div className="mb-6 flex justify-center">
            <img src="/logo.png" alt="Corrus Logo" className="max-w-[180px] h-auto object-contain filter drop-shadow-md" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1 text-center">
            {isLoginMode ? 'Admin Sign In' : 'Register New Admin'}
          </h2>
          <p className="text-xs text-slate-400 mb-6 text-center">
            {isLoginMode ? 'Sign in with your admin credentials' : 'Security key required for new admin registration'}
          </p>

          {isLoginMode ? (
            <form onSubmit={handleAdminLogin} className="w-full flex flex-col gap-4">
              <input
                type="email"
                placeholder="admin.email@corrus.io"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="password"
                placeholder="Admin Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminRegister} className="w-full flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={regFirstname}
                  onChange={(e) => setRegFirstname(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={regLastname}
                  onChange={(e) => setRegLastname(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
                />
              </div>
              <input
                type="email"
                placeholder="admin.email@corrus.io *"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="tel"
                placeholder="10-digit mobile (optional)"
                maxLength={10}
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <input
                type="password"
                placeholder="Create Password *"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
              />
              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Admin Security Key *</label>
                <input
                  type="password"
                  placeholder="Enter admin authorization key"
                  value={regSecurityKey}
                  onChange={(e) => setRegSecurityKey(e.target.value)}
                  className="w-full px-4 py-3 border border-amber-300 bg-amber-50 rounded-lg text-sm text-slate-800 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loginLoading ? 'Registering...' : 'Create Admin Account'}
              </button>
            </form>
          )}

          {/* Toggle Mode */}
          <p className="mt-6 text-sm text-center text-slate-500">
            <span>{isLoginMode ? "Don't have an admin account? " : 'Already have an admin account? '}</span>
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setLoginError('');
              }}
              className="font-semibold text-brand hover:underline cursor-pointer"
            >
              {isLoginMode ? 'Sign Up' : 'Sign In'}
            </button>
          </p>

          {loginError && <p className="mt-4 text-xs font-semibold text-rose-500 text-center">{loginError}</p>}
        </div>
      </div>
    );
  }

  // Admin user initials & canonical ID
  const adminName = adminUser ? `${adminUser.firstname} ${adminUser.lastname || ''}`.trim() : 'Admin';
  const adminInitials = adminUser ? `${adminUser.firstname[0]}${adminUser.lastname ? adminUser.lastname[0] : ''}`.toUpperCase() : 'A';
  const adminIdStr = adminUser ? getCanonicalId('admin', adminUser.id) : '';

  const renderSidebar = false; // Set to true to re-enable left sidebar later

  return (
    <AdminContext.Provider
      value={{
        token,
        users,
        employees,
        companies,
        competitions,
        auditLogs,
        fetchData,
        handleVerifyCompany,
        handleChangeRole,
        handleDeleteUser,
        handleDeleteCompetition
      }}
    >
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Top Navbar */}
        <nav className="w-full bg-brand text-white px-6 py-3 shadow-md flex items-center justify-between z-40 border-b border-white/10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
              <span className="text-sm font-semibold tracking-wide hidden sm:inline">Platform Manager</span>
            </div>

            {/* Top Bar Logged-In User Identity */}
            <div
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg cursor-pointer transition select-none ml-4"
              title={adminIdStr}
            >
              <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center font-bold text-xs">
                {adminInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold leading-tight">{adminName}</span>
                <span className="text-[9px] font-semibold text-slate-300 leading-none">{adminIdStr}</span>
              </div>
              <span className="text-[9px] font-extrabold bg-slate-100/20 text-white border border-white/10 px-2 py-0.5 rounded-full uppercase ml-1">
                Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-500/10 rounded-lg transition duration-150 cursor-pointer"
            >
              Menu
            </button>
          </div>
        </nav>

        {/* Sub-Navbar Navigation */}
        <div className="w-full bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto select-none sticky top-[64px] z-30 shadow-sm">
          <Link
            href="/admin/verification"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/admin/verification'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏢</span> Workspaces
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {companies.length}
            </span>
          </Link>
          <Link
            href="/admin/directory/candidates"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/admin/directory/candidates'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🎓</span> Candidates
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {users.length}
            </span>
          </Link>
          <Link
            href="/admin/directory/employees"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/admin/directory/employees'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>💼</span> Corporate Employees
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {employees.length}
            </span>
          </Link>
          <Link
            href="/admin/directory/challenges"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/admin/directory/challenges'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏆</span> Challenges
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {competitions.length}
            </span>
          </Link>
          <Link
            href="/admin/audit-logs"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/admin/audit-logs'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>📜</span> Audit Log Feed
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {auditLogs.length}
            </span>
          </Link>
        </div>

        <div className="flex flex-1 w-full relative">
          {/* Collapsible Left Sidebar (Hidden but structure preserved) */}
          {renderSidebar && (
            <aside
              className={`bg-white flex flex-col justify-between transition-all duration-300 z-30 select-none ${
                isSidebarOpen ? 'w-64 border-r border-slate-200' : 'w-0 overflow-hidden border-r-0'
              }`}
            >
              <div className="flex flex-col flex-1 overflow-y-auto pt-4">
                <div className="p-4 flex flex-col gap-1">
                  {/* Enterprise Verification Section */}
                  <Link
                    href="/admin/verification"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/admin/verification'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>🏢</span>
                      {isSidebarOpen && <span>Workspaces</span>}
                    </div>
                    {isSidebarOpen && (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                        {companies.length}
                      </span>
                    )}
                  </Link>

                  {/* Collapsible/Group Directory Control */}
                  <div className="flex flex-col border-y border-slate-100 py-2 my-2 gap-1">
                    {isSidebarOpen && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1 block">
                        Directory Control
                      </span>
                    )}
                    
                    {/* Candidates Directory */}
                    <Link
                      href="/admin/directory/candidates"
                      className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                        pathname === '/admin/directory/candidates'
                          ? 'bg-brand/5 text-brand'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span>🎓</span>
                        {isSidebarOpen && <span>Candidates</span>}
                      </div>
                      {isSidebarOpen && (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                          {users.length}
                        </span>
                      )}
                    </Link>

                    {/* Employees Directory */}
                    <Link
                      href="/admin/directory/employees"
                      className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                        pathname === '/admin/directory/employees'
                          ? 'bg-brand/5 text-brand'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span>💼</span>
                        {isSidebarOpen && <span>Corporate Employees</span>}
                      </div>
                      {isSidebarOpen && (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                          {employees.length}
                        </span>
                      )}
                    </Link>

                    {/* Platform Challenges */}
                    <Link
                      href="/admin/directory/challenges"
                      className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                        pathname === '/admin/directory/challenges'
                          ? 'bg-brand/5 text-brand'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span>🏆</span>
                        {isSidebarOpen && <span>Challenges</span>}
                      </div>
                      {isSidebarOpen && (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                          {competitions.length}
                        </span>
                      )}
                    </Link>
                  </div>

                  {/* Audit Log Feed Section */}
                  <Link
                    href="/admin/audit-logs"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/admin/audit-logs'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>📜</span>
                      {isSidebarOpen && <span>Audit Log Feed</span>}
                    </div>
                    {isSidebarOpen && (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                        {auditLogs.length}
                      </span>
                    )}
                  </Link>
                </div>
              </div>

              {/* Logout at bottom */}
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg shadow-sm transition duration-150 cursor-pointer text-center"
                >
                  🚪 {isSidebarOpen && <span>Sign Out</span>}
                </button>
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>

        {/* Side Menu Drawer overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex justify-end z-50 animate-fade-in" onClick={() => setIsMenuOpen(false)}>
            <div className="w-[320px] h-full bg-white border-l border-slate-200 shadow-2xl p-8 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">Dashboard Menu</h3>
                  <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
                </div>
                <ul className="flex flex-col gap-4">
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('settings'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 rounded-lg shadow-sm cursor-pointer transition duration-150"
                    >
                      ⚙️ Portal Settings
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('help'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 rounded-lg shadow-sm cursor-pointer transition duration-150"
                    >
                      ❓ Help & Support
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('about'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 rounded-lg shadow-sm cursor-pointer transition duration-150"
                    >
                      ℹ️ About CORRUS
                    </button>
                  </li>
                </ul>
              </div>
              
              <button
                onClick={logout}
                className="w-full py-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-sm font-semibold rounded-lg shadow-sm transition duration-150 cursor-pointer text-center"
              >
                🚪 Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Dialog Modals Overlay */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setActiveModal(null)} className="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
              
              {activeModal === 'settings' && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Settings</h3>
                  <div className="text-slate-700 text-sm flex flex-col gap-2">
                    <p><strong>Admin Panel:</strong> Fully Authorized</p>
                    <p><strong>Auditing Mode:</strong> Detailed Database logging</p>
                  </div>
                </div>
              )}

              {activeModal === 'help' && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Help & Support</h3>
                  <p className="text-slate-600 text-sm mb-3">Admin query? Contact platform support help desk:</p>
                  <p className="text-slate-700 text-sm"><strong>Email:</strong> support@corrus.io</p>
                </div>
              )}

              {activeModal === 'about' && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">About CORRUS</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    CORRUS is a competence-first skill verification platform linking candidates with real-world company engineering challenges.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminContext.Provider>
  );
}
