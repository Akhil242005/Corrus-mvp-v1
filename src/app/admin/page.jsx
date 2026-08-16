'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();

  // Admin Data states
  const [token, setToken] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Admin Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('verification'); // 'verification', 'users', 'logs'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'settings', 'help', 'about'

  // Initialize and check admin access
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsAuthorized(false);
      return;
    }
    setToken(storedToken);
    fetchData(storedToken);
  }, []);

  const fetchData = async (jwtToken) => {
    try {
      // 1. Fetch directory data
      const dirRes = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (!dirRes.ok) throw new Error('Unauthorized or failed to fetch directories');
      const dirData = await dirRes.json();
      setUsers(dirData.users || []);
      setEmployees(dirData.employees || []);
      setCompanies(dirData.companies || []);
      setCompetitions(dirData.competitions || []);

      // 2. Fetch Audit Logs
      const logsRes = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (logsRes.ok) {
        const logs = await logsRes.json();
        setAuditLogs(logs || []);
      }
      setIsAuthorized(true);
    } catch (err) {
      if (err.message !== 'Unauthorized or failed to fetch directories') {
        console.error('Directory Fetch Error:', err);
      }
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setIsAuthorized(false);
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

      localStorage.setItem('token', data.token);
      setToken(data.token);
      await fetchData(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
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
    if (!confirm(`Are you sure you want to change this user's role to "${targetRole}"?`)) return;

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
    if (!confirm('Are you sure you want to deactivate/delete this user?')) return;

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
    if (!confirm('Are you sure you want to delete this competition?')) return;

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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
        <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-xl shadow-xl p-8 flex flex-col items-center">
          <div className="mb-6 flex justify-center">
            <img src="/logo.png" alt="Corrus Logo" className="max-w-[180px] h-auto object-contain filter drop-shadow-md" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
            System Admin Authentication
          </h2>
          <form onSubmit={handleAdminLogin} className="w-full flex flex-col gap-4">
            <input
              type="email"
              placeholder="admin.email@corrus.io"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
            />
            <input
              type="password"
              placeholder="Admin Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition duration-150"
            />
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-md transition duration-150 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loginLoading ? 'Authenticating...' : 'Authenticate'}
            </button>
          </form>
          {loginError && <p className="mt-4 text-xs font-semibold text-rose-500 text-center">{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="w-full max-w-6xl mx-auto mt-4 px-6 py-3 bg-brand text-white rounded-xl shadow-md flex items-center justify-between z-40 border border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
          <span className="text-sm font-semibold tracking-wide">Platform Manager</span>
        </div>
        
        <ul className="hidden md:flex items-center gap-4">
          <li>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'verification' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Enterprise Verification ({companies.length})
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'users' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Directory Control ({users.length + employees.length})
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'logs' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Audit Log Feed ({auditLogs.length})
            </button>
          </li>
          <li>
            <button onClick={() => setIsMenuOpen(true)} className="px-4 py-2 text-sm font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-500/10 rounded-lg transition duration-150 cursor-pointer">
              Menu
            </button>
          </li>
        </ul>

        {/* Mobile Menu Icon */}
        <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition duration-150 cursor-pointer">
          ☰
        </button>
      </nav>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 capitalize">
            {activeTab === 'verification' ? 'Workspace Verification' : activeTab === 'users' ? 'Global Directory control' : 'Audit Logging Feed'}
          </h1>
          <p className="text-sm text-slate-500">Platform governance panel, log auditing, and user rollouts.</p>
        </div>

        {/* Tab 1: Verification */}
        {activeTab === 'verification' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="p-4 font-bold">Company Name</th>
                  <th className="p-4 font-bold">HQ location</th>
                  <th className="p-4 font-bold">Admin Email</th>
                  <th className="p-4 font-bold">Status Badge</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(comp => (
                  <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-bold text-brand">{comp.name}</td>
                    <td className="p-4 text-slate-600 font-semibold">{comp.place}</td>
                    <td className="p-4 text-slate-600 font-semibold">{comp.adminId?.email || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`text-[11px] font-extrabold border px-2 py-0.5 rounded-full select-none ${
                        comp.isVerified
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {comp.isVerified ? '✓ Verified' : '⌛ Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleVerifyCompany(comp.id, !comp.isVerified)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                          comp.isVerified
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {comp.isVerified ? 'Revoke Verification' : 'Verify Company'}
                      </button>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No corporate workspaces registered on this platform.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Global Directory Control */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-8">
            
            {/* Candidates Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-900">Candidates Directory ({users.length})</h2>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-bold">Name</th>
                      <th className="p-4 font-bold">Email</th>
                      <th className="p-4 font-bold">Phone</th>
                      <th className="p-4 font-bold">Current Role</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-brand">{u.firstname} {u.lastname}</td>
                        <td className="p-4 text-slate-600 font-semibold">{u.email}</td>
                        <td className="p-4 text-slate-600">{u.phone || 'N/A'}</td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full capitalize">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleChangeRole(u.id, u.role)}
                            className="px-2.5 py-1 bg-brand/10 hover:bg-brand/15 text-brand text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Toggle Admin
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No candidates found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Corporate Members Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-900">Corporate Employees Directory ({employees.length})</h2>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-bold">Name</th>
                      <th className="p-4 font-bold">Corporate Email</th>
                      <th className="p-4 font-bold">Company Workspace</th>
                      <th className="p-4 font-bold">Role</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-brand">{emp.firstname} {emp.lastname}</td>
                        <td className="p-4 text-slate-600 font-semibold">{emp.email}</td>
                        <td className="p-4 text-slate-600 font-semibold">{emp.companyId?.name || 'N/A'}</td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full select-none">
                            Employee
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteUser(emp.id)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No company members found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hiring Challenges Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-900">Platform Challenges ({competitions.length})</h2>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-bold">Challenge Title</th>
                      <th className="p-4 font-bold">Company Workspace</th>
                      <th className="p-4 font-bold">Required Experience</th>
                      <th className="p-4 font-bold">Created By</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitions.map(comp => (
                      <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-brand">{comp.title}</td>
                        <td className="p-4 text-slate-600 font-semibold">{comp.companyId?.name || 'N/A'}</td>
                        <td className="p-4 text-slate-600 font-semibold">{comp.experienceRequired}</td>
                        <td className="p-4 text-slate-600">{comp.createdBy?.firstname} {comp.createdBy?.lastname}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteCompetition(comp.id)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {competitions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No challenges published.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Log Feed */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 sticky top-0">
                    <th className="p-4 font-bold">Timestamp</th>
                    <th className="p-4 font-bold">Action</th>
                    <th className="p-4 font-bold">Performed By (User/Admin)</th>
                    <th className="p-4 font-bold">Target Type</th>
                    <th className="p-4 font-bold">Description Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                      <td className="p-4 text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-bold text-brand">{log.action}</td>
                      <td className="p-4 text-slate-700 font-semibold">
                        {log.performedByName} <br />
                        <span className="text-[10px] text-slate-400 font-normal">{log.performedByEmail}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full select-none">
                          {log.targetType}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-semibold whitespace-pre-wrap">{log.details}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No audit logs retrieved.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

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
  );
}
