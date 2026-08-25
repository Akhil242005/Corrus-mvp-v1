'use client';

import { useContext, useState } from 'react';
import { CandidateContext } from '../layout';
import { getCanonicalId } from '@/lib/idMapper';
import CanonicalTag from '@/components/CanonicalTag';

export default function CandidateProfile() {
  const { user, handleUpdateProfile } = useContext(CandidateContext);

  // Profile Edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstname, setEditFirstname] = useState(user.firstname || '');
  const [editLastname, setEditLastname] = useState(user.lastname || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editExperience, setEditExperience] = useState(user.experience || '');
  const [editSkills, setEditSkills] = useState((user.skills || []).join(', '));
  const [editEducation, setEditEducation] = useState(user.education || '');
  const [editProjects, setEditProjects] = useState(user.projects || '');
  const [resumeFile, setResumeFile] = useState(null);
  
  const [profileMsg, setProfileMsg] = useState({ error: '', success: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const onUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ error: '', success: '' });
    setProfileLoading(true);

    const res = await handleUpdateProfile(
      editFirstname,
      editLastname,
      editPhone,
      editExperience,
      editSkills,
      editEducation,
      editProjects,
      resumeFile
    );

    if (res.success) {
      setProfileMsg({ error: '', success: 'Profile updated successfully!' });
      setIsEditingProfile(false);
      setResumeFile(null);
    } else {
      setProfileMsg({ error: res.error || 'Failed to update profile', success: '' });
    }
    setProfileLoading(false);
  };

  const candidateIdStr = getCanonicalId('candidate', user.id);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header Profile Title and ID tag */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>{user.firstname} {user.lastname}</span>
            <span className="text-xs text-slate-400 font-normal">Candidate ID:</span>
            <CanonicalTag type="candidate" id={user.id} />
          </h1>
          <p className="text-sm text-slate-500 mt-1">{user.email} {user.phone ? `• 📞 ${user.phone}` : ''}</p>
        </div>
        <button
          onClick={() => {
            if (isEditingProfile) {
              setResumeFile(null);
              setProfileMsg({ error: '', success: '' });
            }
            setIsEditingProfile(!isEditingProfile);
          }}
          className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition duration-150 cursor-pointer shadow-sm"
        >
          {isEditingProfile ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-6">
        {!isEditingProfile ? (
          // View Mode
          <div className="flex flex-col gap-5 text-sm text-slate-700">
            {user.resumeUrl && (
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">📄 Resume File Loaded</span>
                <a href={user.resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand hover:underline">
                  View Uploaded Resume
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong className="text-slate-400 text-xs uppercase tracking-wide">Skills</strong>
                <p className="text-slate-800 font-semibold mt-1">{(user.skills || []).join(', ') || 'N/A'}</p>
              </div>
              <div>
                <strong className="text-slate-400 text-xs uppercase tracking-wide">Mobile Contact</strong>
                <p className="text-slate-800 font-semibold mt-1">{user.phone || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <strong className="text-slate-400 text-xs uppercase tracking-wide">Professional Experience</strong>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-2">{user.experience || 'Provide your engineering experience.'}</p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <strong className="text-slate-400 text-xs uppercase tracking-wide">Education Details</strong>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-2">{user.education || 'Provide your educational history.'}</p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <strong className="text-slate-400 text-xs uppercase tracking-wide">Featured Engineering Projects</strong>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-2">{user.projects || 'Showcase your portfolio engineering projects.'}</p>
            </div>
          </div>
        ) : (
          // Edit Mode
          <form onSubmit={onUpdateProfile} className="flex flex-col gap-4 text-sm text-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500">First Name *</label>
                <input
                  type="text"
                  value={editFirstname}
                  onChange={(e) => setEditFirstname(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Last Name</label>
                <input
                  type="text"
                  value={editLastname}
                  onChange={(e) => setEditLastname(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Mobile Number (10 digits)</label>
                <input
                  type="tel"
                  value={editPhone}
                  maxLength={10}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={editSkills}
                  placeholder="React, Node.js, Python"
                  onChange={(e) => setEditSkills(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Professional Experience</label>
              <textarea
                value={editExperience}
                onChange={(e) => setEditExperience(e.target.value)}
                rows={3}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Education Details</label>
              <textarea
                value={editEducation}
                onChange={(e) => setEditEducation(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Featured Engineering Projects</label>
              <textarea
                value={editProjects}
                onChange={(e) => setEditProjects(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Upload Resume (PDF, DOC, DOCX - 50KB to 5MB)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => setResumeFile(e.target.files[0])}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 file:cursor-pointer"
              />
            </div>

            {profileMsg.error && <p className="text-xs font-semibold text-rose-500">{profileMsg.error}</p>}
            {profileMsg.success && <p className="text-xs font-semibold text-emerald-500">{profileMsg.success}</p>}

            <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setResumeFile(null);
                  setProfileMsg({ error:'', success:'' });
                }}
                className="px-5 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={profileLoading}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {profileLoading ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
