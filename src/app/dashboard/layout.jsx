'use client';

import { useState, useEffect, createContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCanonicalId } from '@/lib/idMapper';
import Link from 'next/link';

export const CandidateContext = createContext(null);

export default function CandidateLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // App states
  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [token, setToken] = useState('');

  // UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'settings', 'help', 'about', 'success'

  // Initialize and check login status
  useEffect(() => {
    const storedToken = localStorage.getItem('corrus_candidate_token');
    const storedSidebar = localStorage.getItem('corrus_candidate_sidebar_open');

    if (storedSidebar !== null) {
      setIsSidebarOpen(storedSidebar === 'true');
    }

    if (!storedToken) {
      router.push('/');
      return;
    }

    // Decode token and verify role client-side
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      const role = payload.role;
      if (role !== 'user') {
        if (role === 'admin') {
          router.push('/admin');
        } else if (role === 'company_admin' || role === 'company_employee') {
          router.push('/company');
        }
        return;
      }
    } catch (e) {
      router.push('/');
      return;
    }

    setToken(storedToken);
    fetchData(storedToken);
  }, []);

  const fetchData = async (jwtToken) => {
    try {
      // 1. Fetch user profile
      const profRes = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!profRes.ok) {
        logout();
        return;
      }
      const profileData = await profRes.json();
      setUser(profileData);

      // 2. Fetch competitions
      const compRes = await fetch('/api/competitions', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!compRes.ok) {
        logout();
        return;
      }
      const comps = await compRes.json();
      setCompetitions(comps);

      // 3. Calculate enrolled count
      const enrolled = comps.filter(c => c.enrolledUsers?.includes(profileData.id) || false);
      setEnrolledCount(enrolled.length);
    } catch (err) {
      console.error(err);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('corrus_candidate_token');
    router.push('/');
  };

  const toggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem('corrus_candidate_sidebar_open', String(nextState));
  };

  // Handle competition enrollment
  const handleEnroll = async (compId) => {
    if (!user || !user.githubUsername) {
      alert('GitHub account is required for this competition. Redirecting to GitHub sign-in...');
      window.location.href = '/auth/github';
      return;
    }
    try {
      const res = await fetch(`/api/competitions/${compId}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Enrollment failed');
        return;
      }

      // Show success modal and refresh data
      setActiveModal('success');
      fetchData(token);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (firstname, lastname, phone, experience, skills, education, projects, resumeFile) => {
    try {
      const formData = new FormData();
      formData.append('firstname', firstname);
      formData.append('lastname', lastname);
      formData.append('phone', phone);
      formData.append('experience', experience);
      formData.append('skills', skills);
      formData.append('education', education);
      formData.append('projects', projects);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setUser(data.user);
      
      // Reload competitions
      const compRes = await fetch('/api/competitions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (compRes.ok) {
        const comps = await compRes.json();
        setCompetitions(comps);
        const enrolled = comps.filter(c => c.enrolledUsers?.includes(data.user.id) || false);
        setEnrolledCount(enrolled.length);
      }

      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand mb-4"></div>
        <p className="text-slate-600 font-semibold">Loading candidate console...</p>
      </div>
    );
  }

  // Get user identity details
  const userName = `${user.firstname} ${user.lastname || ''}`.trim();
  const userInitials = `${user.firstname[0]}${user.lastname ? user.lastname[0] : ''}`.toUpperCase();
  const userCanonicalId = getCanonicalId('candidate', user.id);

  const renderSidebar = false; // Set to true to re-enable left sidebar later

  return (
    <CandidateContext.Provider
      value={{
        user,
        setUser,
        competitions,
        enrolledCount,
        token,
        fetchData,
        handleEnroll,
        handleUpdateProfile,
        activeModal,
        setActiveModal
      }}
    >
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Top Navbar */}
        <nav className="w-full bg-brand text-white px-6 py-3 shadow-md flex items-center justify-between z-40 border-b border-white/10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
              <span className="text-sm font-semibold tracking-wide hidden sm:inline">Candidate Feed</span>
            </div>

            {/* Top Bar Logged-In User Identity */}
            <div
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg cursor-pointer transition select-none ml-4"
              title={userCanonicalId}
            >
              <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center font-bold text-xs">
                {userInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold leading-tight">{userName}</span>
                <span className="text-[9px] font-semibold text-slate-300 leading-none">{userCanonicalId}</span>
              </div>
              <span className="text-[9px] font-extrabold bg-slate-100/20 text-white border border-white/10 px-2 py-0.5 rounded-full uppercase ml-1">
                Candidate
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
            href="/dashboard/explore"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/dashboard/explore'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🌍</span> Explore Challenges
          </Link>
          <Link
            href="/dashboard/enrolled"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/dashboard/enrolled'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏆</span> My Enrollments
            <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-200">
              {enrolledCount}
            </span>
          </Link>
          <Link
            href="/dashboard/submissions"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/dashboard/submissions'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>📑</span> My Submissions
          </Link>
          <Link
            href="/dashboard/profile"
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition duration-150 flex items-center gap-2 whitespace-nowrap ${
              pathname === '/dashboard/profile'
                ? 'bg-brand/5 text-brand'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>👤</span> My Profile
          </Link>
        </div>

        <div className="flex flex-1 w-full relative">
          {/* Collapsible Sidebar (Hidden but structure preserved) */}
          {renderSidebar && (
            <aside
              className={`bg-white flex flex-col justify-between transition-all duration-300 z-30 select-none ${
                isSidebarOpen ? 'w-64 border-r border-slate-200' : 'w-0 overflow-hidden border-r-0'
              }`}
            >
              <div className="flex flex-col flex-1 overflow-y-auto pt-4">
                <div className="p-4 flex flex-col gap-1">
                  {/* Explore Competitions */}
                  <Link
                    href="/dashboard/explore"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/dashboard/explore'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>🌍</span>
                      {isSidebarOpen && <span>Explore challenges</span>}
                    </div>
                  </Link>

                  {/* My Enrollments */}
                  <Link
                    href="/dashboard/enrolled"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/dashboard/enrolled'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>🏆</span>
                      {isSidebarOpen && <span>My Enrollments</span>}
                    </div>
                    {isSidebarOpen && (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
                        {enrolledCount}
                      </span>
                    )}
                  </Link>

                  {/* My Submissions */}
                  <Link
                    href="/dashboard/submissions"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/dashboard/submissions'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>📑</span>
                      {isSidebarOpen && <span>My Submissions</span>}
                    </div>
                  </Link>

                  {/* Profile Editor */}
                  <Link
                    href="/dashboard/profile"
                    className={`flex items-center justify-between p-3 rounded-lg text-sm font-bold transition duration-150 ${
                      pathname === '/dashboard/profile'
                        ? 'bg-brand/5 text-brand'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>👤</span>
                      {isSidebarOpen && <span>My Profile</span>}
                    </div>
                  </Link>
                </div>
              </div>

              {/* Logout */}
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
              {!user.githubUsername && (
                <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔗</span>
                    <div>
                      <h4 className="font-extrabold text-xs tracking-wider uppercase text-slate-400">GitHub Association Required</h4>
                      <p className="text-slate-200 text-xs font-semibold mt-0.5">Please link your GitHub account to access workspace templates and complete challenge submissions.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = '/auth/github';
                    }}
                    className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-extrabold rounded-xl border border-white/10 shadow-md transition whitespace-nowrap text-center cursor-pointer"
                  >
                    Link GitHub Account
                  </button>
                </div>
              )}
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
                    <p><strong>Theme:</strong> Standard Corporate Slate Navy</p>
                    <p><strong>Notifications:</strong> Competition Updates Enabled</p>
                    <p><strong>Account Status:</strong> Active Candidate</p>
                  </div>
                </div>
              )}

              {activeModal === 'help' && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Help & Support</h3>
                  <p className="text-slate-600 text-sm mb-3">Need assistance? Contact our platform administrator or explore guide docs below:</p>
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

              {activeModal === 'success' && (
                <div className="text-center flex flex-col items-center">
                  <span className="text-5xl mb-2 text-emerald-500">✓</span>
                  <h3 className="text-lg font-bold text-emerald-600 mb-2">Success!</h3>
                  <p className="text-slate-600 text-sm font-semibold">You have enrolled successfully in this competition!</p>
                  <button onClick={() => setActiveModal(null)} className="mt-6 px-6 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition">
                    Close Window
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CandidateContext.Provider>
  );
}
