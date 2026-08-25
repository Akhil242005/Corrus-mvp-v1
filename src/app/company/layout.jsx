'use client';

import { useState, useEffect, createContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCanonicalId } from '@/lib/idMapper';
import Link from 'next/link';

export const CompanyContext = createContext(null);

export default function CompanyLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // Workspace states
  const [token, setToken] = useState('');
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [githubAppInstalled, setGithubAppInstalled] = useState(false);

  // UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'settings', 'help', 'about'

  // Initialize and check login status
  useEffect(() => {
    const storedToken = localStorage.getItem('corrus_company_token');
    const storedSidebar = localStorage.getItem('corrus_company_sidebar_open');

    if (storedSidebar !== null) {
      setIsSidebarOpen(storedSidebar === 'true');
    }

    if (!storedToken) {
      router.push('/');
      return;
    }

    // Decode token and verify role client-side before calling backend API
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      const role = payload.role;
      if (role !== 'company_admin' && role !== 'company_employee') {
        if (role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
        return;
      }
    } catch (e) {
      router.push('/');
      return;
    }

    setToken(storedToken);
    fetchDashboardData(storedToken);
  }, []);

  const fetchDashboardData = async (jwtToken) => {
    try {
      const res = await fetch('/api/company/dashboard', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.passwordResetRequired) {
          router.push('/company-auth/reset-password');
        } else {
          logout();
        }
        return;
      }
      const data = await res.json();

      setCompany(data.company);
      setEmployees(data.employees || []);
      setCompetitions(data.competitions || []);
      setUserRole(data.currentUserRole || '');
      setGithubAppInstalled(!!data.githubAppInstalled);

      // Load profile info for details display
      const profRes = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (profRes.ok) {
        const pData = await profRes.json();
        setCurrentUser(pData);
      }
    } catch (err) {
      console.error(err);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('corrus_company_token');
    router.push('/');
  };

  // Toggle employee approval status (Admin only)
  const handleToggleEmployeeApprove = async (empId, isApproved) => {
    try {
      const res = await fetch(`/api/company/employees/${empId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isApproved })
      });
      const data = await res.json();
      if (res.ok) {
        fetchDashboardData(token);
      } else {
        alert(data.error || 'Failed to update employee status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle posting hiring competition
  const handleAddCompetition = async (title, description, language, skills, experience, other) => {
    try {
      const res = await fetch('/api/company/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          taskDescription: description,
          language,
          skillsRequired: skills.split(',').map(s => s.trim()).filter(Boolean),
          experienceRequired: experience,
          otherRequirements: other
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create competition');
      }

      fetchDashboardData(token);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  };

  // Delete competition
  const handleDeleteCompetition = async (compId) => {
    try {
      const res = await fetch(`/api/company/competitions/${compId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchDashboardData(token);
      } else {
        alert(data.error || 'Failed to delete competition');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle adding employee (Admin only)
  const handleAddEmployee = async (firstname, lastname, email, phone) => {
    try {
      const res = await fetch('/api/company/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          firstname,
          lastname,
          email,
          phone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee');
      }

      fetchDashboardData(token);
      return { success: true, tempPassword: data.tempPassword };
    } catch (err) {
      return { error: err.message };
    }
  };

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-mesh-light">
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-brand/20 border-b-brand mb-4"></div>
        <p className="text-slate-500 font-semibold text-xs tracking-wide">Loading workspace credentials...</p>
      </div>
    );
  }

  // Get user details
  const userName = currentUser ? `${currentUser.firstname} ${currentUser.lastname || ''}`.trim() : 'Representative';
  const userInitials = currentUser ? `${currentUser.firstname[0]}${currentUser.lastname ? currentUser.lastname[0] : ''}`.toUpperCase() : 'C';
  const userIdStr = currentUser ? getCanonicalId(userRole === 'company_admin' ? 'admin' : 'employee', currentUser.id) : '';

  // Badge mapping
  const roleBadgeLabel = userRole === 'company_admin' ? 'Admin' : 'Employee';

  return (
    <CompanyContext.Provider
      value={{
        company,
        employees,
        competitions,
        userRole,
        token,
        githubAppInstalled,
        fetchDashboardData,
        handleToggleEmployeeApprove,
        handleAddCompetition,
        handleDeleteCompetition,
        handleAddEmployee
      }}
    >
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
        {/* Top Navbar */}
        <nav className="w-full bg-white border-b border-slate-200/80 px-6 py-3 shadow-sm flex items-center justify-between z-40 sticky top-0 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="CORRUS Logo" className="h-9 w-auto object-contain filter" />
              <span className="text-xs font-black text-slate-800 tracking-wider uppercase bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-md hidden sm:inline-block">Console</span>
            </div>

            {/* User Account Info Dropdown */}
            <div
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 pl-2 pr-3 py-1.5 rounded-xl cursor-pointer transition-all select-none"
              title={userIdStr}
            >
              <div className="w-6.5 h-6.5 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {userInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-extrabold text-slate-900 leading-tight">{userName}</span>
                <span className="text-[9px] font-bold text-slate-400 leading-none">{userIdStr}</span>
              </div>
              <span className="text-[9px] font-extrabold bg-slate-200/60 text-slate-600 border border-slate-300/40 px-2 py-0.5 rounded-full uppercase ml-1">
                {roleBadgeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200/60 rounded-xl transition duration-150 cursor-pointer shadow-sm"
            >
              Menu Toggle
            </button>
          </div>
        </nav>

        {/* Sub-Navbar Navigation */}
        <div className="w-full bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-1.5 overflow-x-auto select-none sticky top-[61px] z-30 shadow-sm backdrop-blur-md bg-white/95">
          <Link
            href="/company/overview"
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
              pathname === '/company/overview'
                ? 'bg-brand/10 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏢</span> Overview
          </Link>
          <Link
            href="/company/challenges"
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
              pathname === '/company/challenges'
                ? 'bg-brand/10 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏆</span> Challenges Published
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
              pathname === '/company/challenges'
                ? 'bg-brand text-white border-brand'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {competitions.length}
            </span>
          </Link>
          {userRole === 'company_admin' && (
            <Link
              href="/company/employees"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
                pathname === '/company/employees'
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>👥</span> Employee Workspace
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                pathname === '/company/employees'
                  ? 'bg-brand text-white border-brand'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {employees.length}
              </span>
            </Link>
          )}
          <Link
            href="/company/candidates"
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
              pathname === '/company/candidates'
                ? 'bg-brand/10 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🎓</span> Candidate Roster
          </Link>
          <Link
            href="/company/submissions"
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
              pathname === '/company/submissions'
                ? 'bg-brand/10 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>📑</span> Solution Submissions
          </Link>
        </div>

        {/* Main Content Frame */}
        <div className="flex-1 flex flex-col relative w-full">
          <main className="flex-1 p-6 md:p-8">
            <div className="max-w-5xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>

        {/* Slide Menu Drawer */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={() => setIsMenuOpen(false)}>
            <div className="w-[300px] h-full bg-white border-l border-slate-200/80 shadow-2xl p-6 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Workspace Menu</h3>
                  <button onClick={() => setIsMenuOpen(false)} className="text-xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
                </div>
                <ul className="flex flex-col gap-3">
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('settings'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-xs font-extrabold text-slate-700 rounded-xl cursor-pointer transition"
                    >
                      ⚙️ Portal Settings
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('help'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-xs font-extrabold text-slate-700 rounded-xl cursor-pointer transition"
                    >
                      ❓ Support Desk
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setIsMenuOpen(false); setActiveModal('about'); }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-xs font-extrabold text-slate-700 rounded-xl cursor-pointer transition"
                    >
                      ℹ️ About CORRUS
                    </button>
                  </li>
                </ul>
              </div>
              
              <button
                onClick={logout}
                className="w-full py-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer text-center"
              >
                🚪 Sign Out Workspace
              </button>
            </div>
          </div>
        )}

        {/* Dialog Modals */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-modal" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setActiveModal(null)} className="absolute top-3.5 right-4 text-xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
              
              {activeModal === 'settings' && (
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">Console Settings</h3>
                  <div className="text-slate-700 text-xs flex flex-col gap-2.5">
                    <p><strong>Active Workspace:</strong> {company.name}</p>
                    <p><strong>Admin Permission:</strong> {userRole === 'company_admin' ? 'Granted' : 'Read/Write Representative'}</p>
                    <p><strong>System Audit logging:</strong> Active</p>
                  </div>
                </div>
              )}

              {activeModal === 'help' && (
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">Support Center</h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-3">Enterprise query? Contact our developer support help desk:</p>
                  <p className="text-slate-700 text-xs font-bold"><strong>Email:</strong> support@corrus.io</p>
                </div>
              )}

              {activeModal === 'about' && (
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">About CORRUS</h3>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    CORRUS is a competence-first skill verification platform linking candidates with real-world company engineering challenges.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CompanyContext.Provider>
  );
}
