'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyDashboard() {
  const router = useRouter();

  // Workspace states
  const [token, setToken] = useState('');
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [userRole, setUserRole] = useState('');

  // Dashboard UI states
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'competitions', 'employees'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Post Competition Form states
  const [isAddingComp, setIsAddingComp] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compSkills, setCompSkills] = useState('');
  const [compExp, setCompExp] = useState('Entry-Level (0-2 years)');
  const [compOther, setCompOther] = useState('');
  const [compError, setCompError] = useState('');
  const [compSuccess, setCompSuccess] = useState('');
  
  // Add Employee Form states
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [empFirstname, setEmpFirstname] = useState('');
  const [empLastname, setEmpLastname] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState('');

  // Enrolled Candidates showcase modal states
  const [selectedComp, setSelectedComp] = useState(null);
  const [enrolledCandidates, setEnrolledCandidates] = useState([]);
  const [isEnrolledOpen, setIsEnrolledOpen] = useState(false);

  // Dialog Modals states
  const [activeModal, setActiveModal] = useState(null); // 'settings', 'help', 'about'

  // Initialize and check login status
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch dashboard data');
      }

      setCompany(data.company);
      setEmployees(data.employees || []);
      setCompetitions(data.competitions || []);
      setUserRole(data.currentUserRole || '');
    } catch (err) {
      console.error(err);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  // Handle posting hiring competition
  const handleAddCompetition = async (e) => {
    e.preventDefault();
    setCompError('');
    setCompSuccess('');

    if (!compTitle.trim() || !compDesc.trim()) {
      setCompError('Title and task description are required');
      return;
    }

    try {
      const res = await fetch('/api/company/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: compTitle,
          taskDescription: compDesc,
          skillsRequired: compSkills,
          experienceRequired: compExp,
          otherRequirements: compOther
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish competition');
      }

      setCompSuccess('Hiring challenge published successfully!');
      
      // Reset form fields
      setCompTitle('');
      setCompDesc('');
      setCompSkills('');
      setCompExp('Entry-Level (0-2 years)');
      setCompOther('');
      setIsAddingComp(false);

      // Refresh listings
      fetchDashboardData(token);
    } catch (err) {
      setCompError(err.message);
    }
  };

  // Handle soft deleting a competition
  const handleDeleteCompetition = async (compId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this competition?')) return;

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

  // Handle viewing enrolled candidates
  const handleViewEnrolled = async (competition, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/company/competitions/${competition.id}/enrolled`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedComp(competition);
        setEnrolledCandidates(data.enrolledUsers || []);
        setIsEnrolledOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle adding employee (Admin only)
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setEmpError('');
    setEmpSuccess('');

    if (!empFirstname.trim() || !empEmail.trim() || !empPassword.trim()) {
      setEmpError('First name, email, and password are required');
      return;
    }

    try {
      const res = await fetch('/api/company/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          firstname: empFirstname,
          lastname: empLastname,
          email: empEmail,
          phone: empPhone,
          password: empPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee');
      }

      setEmpSuccess('Employee created successfully!');
      
      // Reset form fields
      setEmpFirstname('');
      setEmpLastname('');
      setEmpEmail('');
      setEmpPhone('');
      setEmpPassword('');
      setIsAddingEmp(false);

      // Refresh listings
      fetchDashboardData(token);
    } catch (err) {
      setEmpError(err.message);
    }
  };

  // Handle approving / revoking employee status (Admin only)
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

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand mb-4"></div>
        <p className="text-slate-600 font-semibold">Loading company workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="w-full max-w-6xl mx-auto mt-4 px-6 py-3 bg-brand text-white rounded-xl shadow-md flex items-center justify-between z-40 border border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
          <span className="text-sm font-semibold tracking-wide">Company Console</span>
        </div>
        
        <ul className="hidden md:flex items-center gap-4">
          <li>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'overview' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Workspace Overview
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('competitions')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'competitions' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Hiring Challenges ({competitions.length})
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'employees' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Member Management ({employees.length})
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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">
        
        {/* Workspace Title & Verified Status Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand flex items-center gap-2">
              <span>{company.name}</span>
              <span className={`text-[11px] font-extrabold border px-2 py-0.5 rounded-full select-none ${
                company.isVerified
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}>
                {company.isVerified ? '✓ Verified Workspace' : '⌛ Pending Verification'}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">{company.place} • {company.website || 'No website listed'}</p>
          </div>

          <div className="flex gap-2">
            {activeTab === 'competitions' && (
              <button
                disabled={!company.isVerified}
                onClick={() => setIsAddingComp(true)}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition duration-150 cursor-pointer"
              >
                + Publish Hiring Challenge
              </button>
            )}
            {activeTab === 'employees' && userRole === 'company_admin' && (
              <button
                onClick={() => setIsAddingEmp(true)}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm transition duration-150 cursor-pointer"
              >
                + Register New Employee
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Info Cards */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Workspace Description */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Workspace Summary</h3>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {company.description || 'Provide an enterprise overview inside workspace profile settings.'}
                </p>
              </div>

              {/* Statistics Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                  <span className="text-2xl font-black text-brand">{competitions.length}</span>
                  <p className="text-xs font-bold text-slate-400 mt-1">Challenges Published</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                  <span className="text-2xl font-black text-brand">{employees.length + 1}</span>
                  <p className="text-xs font-bold text-slate-400 mt-1">Corporate Users</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                  <span className="text-2xl font-black text-emerald-500">{company.isVerified ? 'Verified' : 'Pending'}</span>
                  <p className="text-xs font-bold text-slate-400 mt-1">Verification Status</p>
                </div>
              </div>
            </div>

            {/* Admin Profile */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Workspace Creator</h3>
              <div className="flex flex-col gap-1 text-sm text-slate-700">
                <p className="text-lg font-bold text-brand">{company.adminId.firstname} {company.adminId.lastname}</p>
                <p className="text-slate-400 font-semibold">{company.adminId.email}</p>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full select-none w-max mt-2">
                  Company Admin
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hiring Challenges */}
        {activeTab === 'competitions' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="p-4 font-bold">Challenge Title</th>
                  <th className="p-4 font-bold">Required Experience</th>
                  <th className="p-4 font-bold">Key Skills</th>
                  <th className="p-4 font-bold">Created By</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-bold text-brand">{c.title}</td>
                    <td className="p-4 text-slate-600 font-semibold">{c.experienceRequired}</td>
                    <td className="p-4 text-xs font-semibold text-slate-500">{c.skillsRequired.join(', ')}</td>
                    <td className="p-4 text-slate-600">{c.createdBy.firstname} {c.createdBy.lastname}</td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleViewEnrolled(c, e)}
                        className="px-3 py-1 bg-brand/10 hover:bg-brand/15 text-brand text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Candidates Roster
                      </button>
                      <button
                        onClick={(e) => handleDeleteCompetition(c.id, e)}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {competitions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No hiring challenges published yet. Click '+ Publish Hiring Challenge' to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Employee Management */}
        {activeTab === 'employees' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="p-4 font-bold">Full Name</th>
                  <th className="p-4 font-bold">Corporate Email</th>
                  <th className="p-4 font-bold">Mobile Phone</th>
                  <th className="p-4 font-bold">Access Status</th>
                  {userRole === 'company_admin' && <th className="p-4 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-bold text-brand">{emp.firstname} {emp.lastname}</td>
                    <td className="p-4 text-slate-600 font-semibold">{emp.email}</td>
                    <td className="p-4 text-slate-600">{emp.phone || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`text-[11px] font-extrabold border px-2 py-0.5 rounded-full select-none ${
                        emp.isApproved
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {emp.isApproved ? 'Approved' : 'Access Revoked'}
                      </span>
                    </td>
                    {userRole === 'company_admin' && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleEmployeeApprove(emp.id, !emp.isApproved)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            emp.isApproved
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {emp.isApproved ? 'Revoke Access' : 'Approve User'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No corporate employees registered under this workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                  <p><strong>Workspace:</strong> {company.name}</p>
                  <p><strong>Role status:</strong> {userRole === 'company_admin' ? 'Admin Creator' : 'Corporate Member'}</p>
                  <p><strong>Audit Logging:</strong> Fully Compliant</p>
                </div>
              </div>
            )}

            {activeModal === 'help' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Help & Support</h3>
                <p className="text-slate-600 text-sm mb-3">Enterprise query? Contact our developer support help desk:</p>
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

      {/* Showcase Enrolled Candidates Modal */}
      {isEnrolledOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsEnrolledOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsEnrolledOpen(false)} className="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
              Enrolled Candidates: "{selectedComp.title}"
            </h3>

            {enrolledCandidates.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium text-center py-8">No candidates have enrolled in this hiring challenge yet.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="p-3">Candidate Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Enrolled At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledCandidates.map(cand => (
                      <tr key={cand.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand">{cand.firstname} {cand.lastname}</td>
                        <td className="p-3 text-slate-600 font-semibold">{cand.email}</td>
                        <td className="p-3 text-slate-600">{cand.phone || 'N/A'}</td>
                        <td className="p-3 text-slate-500">{new Date(cand.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsEnrolledOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Competition Modal Form overlay */}
      {isAddingComp && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsAddingComp(false)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-8 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsAddingComp(false)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-6">
              Publish Hiring Challenge
            </h3>

            <form onSubmit={handleAddCompetition} className="flex flex-col gap-4 text-sm text-slate-700">
              <div>
                <label className="text-xs font-bold text-slate-500">Challenge Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Backend Engineer Challenge"
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Task Description & Brief *</label>
                <textarea
                  placeholder="Describe the real-world engineering problem candidates should solve..."
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  rows={4}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 font-sans">Experience Level *</label>
                  <select
                    value={compExp}
                    onChange={(e) => setCompExp(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                  >
                    <option value="Entry-Level (0-2 years)">Entry-Level (0-2 years)</option>
                    <option value="Mid-Level (2-5 years)">Mid-Level (2-5 years)</option>
                    <option value="Senior (5+ years)">Senior (5+ years)</option>
                    <option value="Executive/Lead">Executive/Lead</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500">Skills Required (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="React, PostgreSQL, REST APIs"
                    value={compSkills}
                    onChange={(e) => setCompSkills(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Other Prerequisites / Requirements</label>
                <textarea
                  placeholder="e.g. Remote work, local timezone, specific degree requirements..."
                  value={compOther}
                  onChange={(e) => setCompOther(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingComp(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
                >
                  Publish Challenge
                </button>
              </div>

              {compError && <p className="text-xs font-bold text-rose-500 text-center">{compError}</p>}
              {compSuccess && <p className="text-xs font-bold text-emerald-500 text-center">{compSuccess}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal Form overlay */}
      {isAddingEmp && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsAddingEmp(false)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-8 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsAddingEmp(false)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-6">
              Register New Employee
            </h3>

            <form onSubmit={handleAddEmployee} className="flex flex-col gap-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">First Name *</label>
                  <input
                    type="text"
                    value={empFirstname}
                    onChange={(e) => setEmpFirstname(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Last Name</label>
                  <input
                    type="text"
                    value={empLastname}
                    onChange={(e) => setEmpLastname(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Mobile Phone</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Corporate Email Address *</label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Workspace Access Password *</label>
                <input
                  type="password"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEmp(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
                >
                  Create Account
                </button>
              </div>

              {empError && <p className="text-xs font-bold text-rose-500 text-center">{empError}</p>}
              {empSuccess && <p className="text-xs font-bold text-emerald-500 text-center">{empSuccess}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
