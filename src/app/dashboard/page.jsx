'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CandidateDashboard() {
  const router = useRouter();
  
  // App states
  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' or 'enrolled'
  const [token, setToken] = useState('');

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Profile Edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstname, setEditFirstname] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editProjects, setEditProjects] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [profileMsg, setProfileMsg] = useState({ error: '', success: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Dialog Modals states
  const [activeModal, setActiveModal] = useState(null); // 'settings', 'help', 'about', 'success', 'showcase'
  const [showcaseCompany, setShowcaseCompany] = useState(null);
  const [showcaseCompetitions, setShowcaseCompetitions] = useState([]);
  
  // Competition Details state
  const [selectedCompetition, setSelectedCompetition] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Initialize and check login status
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
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
      if (!profRes.ok) throw new Error('Failed to fetch profile');
      const profileData = await profRes.json();
      setUser(profileData);
      
      // Populate profile edit states
      setEditFirstname(profileData.firstname || '');
      setEditLastname(profileData.lastname || '');
      setEditPhone(profileData.phone || '');
      setEditExperience(profileData.experience || '');
      setEditSkills((profileData.skills || []).join(', '));
      setEditEducation(profileData.education || '');
      setEditProjects(profileData.projects || '');

      // 2. Fetch competitions
      const compRes = await fetch('/api/competitions', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!compRes.ok) throw new Error('Failed to fetch competitions');
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
    localStorage.removeItem('token');
    router.push('/');
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ error: '', success: '' });
    setProfileLoading(true);

    try {
      const formData = new FormData();
      formData.append('firstname', editFirstname);
      formData.append('lastname', editLastname);
      formData.append('phone', editPhone);
      formData.append('experience', editExperience);
      formData.append('skills', editSkills);
      formData.append('education', editEducation);
      formData.append('projects', editProjects);
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
      setProfileMsg({ error: '', success: 'Profile updated successfully!' });
      setIsEditingProfile(false);
      setResumeFile(null);
      
      // Sync enrolled count and reload comps
      const compRes = await fetch('/api/competitions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (compRes.ok) {
        const comps = await compRes.json();
        setCompetitions(comps);
      }
    } catch (err) {
      setProfileMsg({ error: err.message, success: '' });
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle competition enrollment
  const handleEnroll = async (compId) => {
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

  // Handle company showcase lookup
  const handleOpenCompanyShowcase = async (companyId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setShowcaseCompany(data.company);
        setShowcaseCompetitions(data.competitions);
        setActiveModal('showcase');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter listings
  const getFilteredCompetitions = () => {
    let list = competitions;

    // Filter by tab
    if (activeTab === 'enrolled' && user) {
      // In next.js, enrolledUsers may not be populated, so we compare list of enrollments.
      // But the api fetches competition feed where c.enrolledUsers is not returned for security,
      // so in our database schema enrollments are stored in competition_enrollments.
      // Let's make sure we filter the competitions where we enrolled.
      // Wait, let's verify: in standard Express, req.user.userId is used. We can verify if user is enrolled
      // by fetching the candidate dashboard or checking list.
      // Wait, let's look at `GET /api/competitions` which populates enrolledUsers? No, in mongoose, enrolledUsers is an array.
      // We can fetch competitions that user enrolled. Let's see how our mock client checks it.
      // Actually, since we return enrolledUsers list, we can verify!
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.taskDescription.toLowerCase().includes(q) ||
        c.companyId.name.toLowerCase().includes(q)
      );
    }

    // Filter by selected companies
    if (selectedCompanies.length > 0) {
      list = list.filter(c => selectedCompanies.includes(c.companyId.id.toString()));
    }

    // Filter by selected skills
    if (selectedSkills.length > 0) {
      list = list.filter(c =>
        c.skillsRequired.some(skill => selectedSkills.includes(skill.toLowerCase()))
      );
    }

    return list;
  };

  // Extract unique companies and skills for sidebar filters
  const uniqueCompanies = [];
  const uniqueSkills = [];
  competitions.forEach(c => {
    if (c.companyId && !uniqueCompanies.some(comp => comp.id === c.companyId.id)) {
      uniqueCompanies.push(c.companyId);
    }
    (c.skillsRequired || []).forEach(skill => {
      const s = skill.trim().toLowerCase();
      if (s && !uniqueSkills.includes(s)) {
        uniqueSkills.push(s);
      }
    });
  });

  const filteredCompetitions = getFilteredCompetitions();
  
  // Enrolled comps list
  // Wait! In the API, how do we know if user is enrolled?
  // Let's look at our mock DB schema: in next.js route helper we can fetch enrollments,
  // or return enrolled list.
  // Wait, let's look at the database schema migration script. It creates `competition_enrollments` table.
  // Let's modify the GET /api/competitions endpoint in `src/app/api/competitions/route.js`
  // so that it populates an `isEnrolled` boolean or returns the enrolled candidate IDs!
  // Wait, returning the list of enrolled user IDs for each competition in the feed:
  // `SELECT user_id FROM competition_enrollments WHERE competition_id = id`
  // That's exactly what we did, or we can populate a boolean `isEnrolled` if req.user is set!
  // Yes! If we populate `isEnrolled` or check if user.id is in enrolledUsers.
  // In `src/app/api/competitions/route.js`, we can fetch all enrollments and add `enrolledUsers: Array of IDs` to the object!
  // Let's make sure our route handles that, or we check it.
  
  // Calculate total pages for explore feed
  const exploreCompetitions = activeTab === 'explore'
    ? filteredCompetitions
    : filteredCompetitions.filter(c => c.enrolledUsers?.includes(user?.id) || false);

  const totalPages = Math.ceil(exploreCompetitions.length / itemsPerPage);
  const paginatedCompetitions = exploreCompetitions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="w-full max-w-6xl mx-auto mt-4 px-6 py-3 bg-brand text-white rounded-xl shadow-md flex items-center justify-between z-40 border border-white/10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
          <img src="/logo.png" alt="CORRUS Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
          <span className="text-sm font-semibold tracking-wide">Candidate Feed</span>
        </div>
        
        <ul className="hidden md:flex items-center gap-4">
          <li>
            <button
              onClick={() => { setActiveTab('explore'); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'explore' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              Explore Competitions
            </button>
          </li>
          <li>
            <button
              onClick={() => { setActiveTab('enrolled'); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'enrolled' ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              My Enrolled ({enrolledCount})
            </button>
          </li>
          <li>
            <button onClick={() => setIsProfileOpen(true)} className="px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 rounded-lg transition duration-150 cursor-pointer">
              My Profile
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
        {/* Title Bar & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 capitalize">{activeTab} Competitions</h1>
            <p className="text-sm text-slate-500">Discover competence challenges & verify your engineering skills.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search challenges, keywords, companies..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 w-full md:w-80 transition duration-150 shadow-sm"
            />
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition duration-150"
            >
              <span>⚙️</span>
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Competitions Grid */}
        {paginatedCompetitions.length === 0 ? (
          <div className="w-full bg-white border border-slate-200 rounded-xl p-12 text-center shadow-md">
            <p className="text-slate-400 text-lg font-medium">No active competitions found.</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your search queries or filter categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCompetitions.map(c => {
              const hasEnrolled = c.enrolledUsers?.includes(user?.id) || false;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCompetition(c)}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-lg font-bold text-brand leading-tight line-clamp-1">{c.title}</h3>
                      {hasEnrolled && (
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          Enrolled
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-3">
                      By{' '}
                      <a
                        href="#"
                        onClick={(e) => handleOpenCompanyShowcase(c.companyId.id, e)}
                        className="font-semibold text-slate-700 underline hover:text-brand"
                      >
                        {c.companyId?.name}
                      </a>
                    </p>

                    <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                      {c.taskDescription}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                    <p className="text-xs text-slate-500">
                      <strong>Required Skills:</strong> {c.skillsRequired.join(', ') || 'N/A'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold text-slate-600">🕒 {c.experienceRequired} exp</span>
                      {!hasEnrolled && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEnroll(c.id); }}
                          className="px-4 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition duration-150"
                        >
                          Enroll Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="w-full flex items-center justify-between border-t border-slate-200 pt-4 mt-2">
            <span className="text-xs text-slate-500 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Side Menu Drawer overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex justify-end z-50 animate-fade-in" onClick={() => setIsMenuOpen(false)}>
          <div className="w-[320px] h-full bg-white border-l border-slate-200 shadow-2xl p-8 flex flex-col justify-between animate-slide-left" onClick={(e) => e.stopPropagation()}>
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

      {/* Filter Sidebar Drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex justify-start z-50" onClick={() => setIsFilterOpen(false)}>
          <div className="w-[300px] h-full bg-white border-r border-slate-200 shadow-2xl p-6 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Filter Challenges</h3>
                <button onClick={() => setIsFilterOpen(false)} className="text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
              </div>

              {/* By Company Accordion */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">By Company</h4>
                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-[160px] overflow-y-auto">
                  {uniqueCompanies.map(comp => (
                    <label key={comp.id} className="flex items-center gap-3 text-xs text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(comp.id.toString())}
                        onChange={(e) => {
                          const val = comp.id.toString();
                          setSelectedCompanies(e.target.checked
                            ? [...selectedCompanies, val]
                            : selectedCompanies.filter(item => item !== val)
                          );
                          setCurrentPage(1);
                        }}
                        className="w-4 h-4 accent-brand border-slate-300 rounded cursor-pointer"
                      />
                      <span>{comp.name}</span>
                    </label>
                  ))}
                  {uniqueCompanies.length === 0 && <span className="text-xs text-slate-400">No companies found.</span>}
                </div>
              </div>

              {/* By Skill Accordion */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">By Skills Required</h4>
                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-[160px] overflow-y-auto">
                  {uniqueSkills.map(skill => (
                    <label key={skill} className="flex items-center gap-3 text-xs text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedSkills.includes(skill)}
                        onChange={(e) => {
                          setSelectedSkills(e.target.checked
                            ? [...selectedSkills, skill]
                            : selectedSkills.filter(item => item !== skill)
                          );
                          setCurrentPage(1);
                        }}
                        className="w-4 h-4 accent-brand border-slate-300 rounded cursor-pointer"
                      />
                      <span className="capitalize">{skill}</span>
                    </label>
                  ))}
                  {uniqueSkills.length === 0 && <span className="text-xs text-slate-400">No skills found.</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => {
                  setSelectedCompanies([]);
                  setSelectedSkills([]);
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition duration-150 cursor-pointer"
              >
                Reset All Filters
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition duration-150 cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Sidebar Drawer overlay */}
      {isProfileOpen && user && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex justify-end z-50" onClick={() => setIsProfileOpen(false)}>
          <div className="w-[450px] max-w-full h-full bg-white border-l border-slate-200 shadow-2xl p-8 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">My Platform Profile</h3>
                <button onClick={() => setIsProfileOpen(false)} className="text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
              </div>

              {!isEditingProfile ? (
                // View Mode
                <div className="flex flex-col gap-4 text-sm">
                  <div>
                    <h4 className="text-xl font-bold text-brand">{user.firstname} {user.lastname}</h4>
                    <p className="text-slate-400">{user.email}</p>
                    {user.phone && <p className="text-slate-500">📞 {user.phone}</p>}
                  </div>
                  
                  {user.resumeUrl && (
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-semibold">📄 Resume File Loaded</span>
                      <a href={user.resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand hover:underline">
                        View Uploaded Resume
                      </a>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-2">
                    <div>
                      <strong className="text-slate-400 text-xs uppercase tracking-wide">Skills</strong>
                      <p className="text-slate-800 font-medium mt-1">{(user.skills || []).join(', ') || 'N/A'}</p>
                    </div>
                    <div>
                      <strong className="text-slate-400 text-xs uppercase tracking-wide">Experience</strong>
                      <p className="text-slate-800 whitespace-pre-wrap mt-1">{user.experience || 'N/A'}</p>
                    </div>
                    <div>
                      <strong className="text-slate-400 text-xs uppercase tracking-wide">Education</strong>
                      <p className="text-slate-800 whitespace-pre-wrap mt-1">{user.education || 'N/A'}</p>
                    </div>
                    <div>
                      <strong className="text-slate-400 text-xs uppercase tracking-wide">Projects</strong>
                      <p className="text-slate-800 whitespace-pre-wrap mt-1">{user.projects || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Edit Mode
                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500">First Name</label>
                      <input
                        type="text"
                        value={editFirstname}
                        onChange={(e) => setEditFirstname(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500">Last Name</label>
                      <input
                        type="text"
                        value={editLastname}
                        onChange={(e) => setEditLastname(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Mobile Number (10 digits)</label>
                    <input
                      type="tel"
                      value={editPhone}
                      maxLength={10}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Skills (Comma-separated)</label>
                    <input
                      type="text"
                      value={editSkills}
                      placeholder="React, Node.js, Python, PostgreSQL"
                      onChange={(e) => setEditSkills(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Professional Experience</label>
                    <textarea
                      value={editExperience}
                      onChange={(e) => setEditExperience(e.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Education Details</label>
                    <textarea
                      value={editEducation}
                      onChange={(e) => setEditEducation(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Featured Engineering Projects</label>
                    <textarea
                      value={editProjects}
                      onChange={(e) => setEditProjects(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Upload Resume (PDF, DOC, DOCX - 50KB to 5MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setResumeFile(e.target.files[0])}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 file:cursor-pointer"
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Profile Action Buttons */}
            <div className="border-t border-slate-100 pt-4 flex gap-3 mt-4">
              {!isEditingProfile ? (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition duration-150 cursor-pointer text-center shadow-sm"
                >
                  Edit Profile Information
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setIsEditingProfile(false); setResumeFile(null); setProfileMsg({ error:'', success:'' }); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {profileLoading ? 'Saving...' : 'Save Updates'}
                  </button>
                </>
              )}
            </div>
            
            {profileMsg.error && <p className="mt-2 text-xs font-semibold text-rose-500 text-center">{profileMsg.error}</p>}
            {profileMsg.success && <p className="mt-2 text-xs font-semibold text-emerald-500 text-center">{profileMsg.success}</p>}
          </div>
        </div>
      )}

      {/* Dialog Modals Overlay */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-modal" onClick={(e) => e.stopPropagation()}>
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

            {activeModal === 'showcase' && showcaseCompany && (
              <div className="max-w-xl text-sm">
                <h2 className="text-xl font-bold text-brand mb-2">{showcaseCompany.name}</h2>
                <p className="mb-2"><strong>Location:</strong> {showcaseCompany.place}</p>
                {showcaseCompany.website && (
                  <p className="mb-2">
                    <strong>Website:</strong>{' '}
                    <a href={showcaseCompany.website} target="_blank" rel="noreferrer" className="text-brand font-semibold underline hover:text-brand-hover">
                      {showcaseCompany.website}
                    </a>
                  </p>
                )}
                {showcaseCompany.description && (
                  <p className="text-slate-600 italic border-l-2 border-slate-200 pl-3 my-3">
                    "{showcaseCompany.description}"
                  </p>
                )}

                <h3 className="text-sm font-bold text-slate-900 border-t border-slate-100 pt-3 mt-4 mb-2">Active Challenges</h3>
                {showcaseCompetitions.length === 0 ? (
                  <p className="text-xs text-slate-400">No active competitions published.</p>
                ) : (
                  <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="p-2.5 font-bold text-slate-700">Challenge Title</th>
                          <th className="p-2.5 font-bold text-slate-700">Experience</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showcaseCompetitions.map(sc => (
                          <tr key={sc.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2.5 text-slate-800 font-semibold">{sc.title}</td>
                            <td className="p-2.5 text-slate-600">{sc.experienceRequired}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Competition Details Modal overlay */}
      {selectedCompetition && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedCompetition(null)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-8 w-full max-w-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedCompetition(null)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h2 className="text-2xl font-bold text-brand mb-2">{selectedCompetition.title}</h2>
            <p className="text-xs text-slate-400 mb-6">
              Published by{' '}
              <a
                href="#"
                onClick={(e) => { setSelectedCompetition(null); handleOpenCompanyShowcase(selectedCompetition.companyId.id, e); }}
                className="font-semibold text-slate-700 underline hover:text-brand"
              >
                {selectedCompetition.companyId?.name}
              </a>
            </p>

            <div className="flex flex-col gap-4 text-sm text-slate-700 mb-6">
              <div>
                <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Challenge Brief</strong>
                <p className="leading-relaxed bg-slate-50 border border-slate-200 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedCompetition.taskDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Skills Required</strong>
                  <p className="font-semibold text-slate-800">
                    {selectedCompetition.skillsRequired.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Experience Requirement</strong>
                  <p className="font-semibold text-slate-800">
                    {selectedCompetition.experienceRequired}
                  </p>
                </div>
              </div>

              {selectedCompetition.otherRequirements && (
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Other Criteria</strong>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedCompetition.otherRequirements}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedCompetition(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              {!(selectedCompetition.enrolledUsers?.includes(user?.id) || false) && (
                <button
                  onClick={() => { setSelectedCompetition(null); handleEnroll(selectedCompetition.id); }}
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg shadow-md transition duration-150 cursor-pointer"
                >
                  Enroll in Competition
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
