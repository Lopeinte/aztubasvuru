'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CandidateSubmission, Language } from '@/types';
import { adminTranslations } from '@/lib/translations';
import {
  Compass,
  Lock,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  MessageCircle,
  BrainCircuit,
  LogOut,
  Layers,
  Award,
  Users,
  Eye,
  ArrowUpDown,
  RefreshCw,
  Globe
} from 'lucide-react';

export default function AdminPage() {
  const [lang, setLang] = useState<Language>('az');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [candidates, setCandidates] = useState<CandidateSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  // Selected Candidate for Detail Modal
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSubmission | null>(null);

  const t = adminTranslations[lang] || adminTranslations.az;

  // Change Language
  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('aztu_admin_lang', newLang);
  };

  // Check login on mount
  useEffect(() => {
    // 1. Language preference
    const savedLang = localStorage.getItem('aztu_admin_lang') as Language;
    if (savedLang && ['az', 'tr', 'en'].includes(savedLang)) {
      setLang(savedLang);
    }

    // 2. Session verification (Strict - never auto-authenticate without saved token)
    const token = sessionStorage.getItem('aztu_admin_token');
    if (token) {
      fetchCandidates(token);
    } else {
      setIsCheckingAuth(false);
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t.invalidPassword);
      }

      const validToken = data.token || 'aztu_admin_authenticated_2026';
      sessionStorage.setItem('aztu_admin_token', validToken);
      setIsAuthenticated(true);
      setPasswordInput('');
      fetchCandidates(validToken);
    } catch (err: any) {
      setLoginError(err.message || t.invalidPassword);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
    } catch (e) {
      console.warn('Logout API error:', e);
    }
    sessionStorage.removeItem('aztu_admin_token');
    setIsAuthenticated(false);
    setCandidates([]);
    setSelectedCandidate(null);
    setPasswordInput('');
  };

  const fetchCandidates = async (explicitToken?: string) => {
    const token = explicitToken || sessionStorage.getItem('aztu_admin_token');
    if (!token) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setIsAuthenticated(true);
      } else if (res.status === 401) {
        sessionStorage.removeItem('aztu_admin_token');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Fetch candidates error:', err);
    } finally {
      setLoading(false);
      setIsCheckingAuth(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" ${t.confirmDelete}`)) return;

    const token = sessionStorage.getItem('aztu_admin_token');
    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        setCandidates(prev => prev.filter(c => c.id !== id));
        if (selectedCandidate?.id === id) setSelectedCandidate(null);
      } else {
        alert(t.deleteError);
      }
    } catch (err) {
      alert(t.deleteError);
    }
  };

  // Filtered & Sorted list
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.groupNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    const matchesDept = deptFilter === 'all' || c.department === deptFilter;

    let matchesScore = true;
    const score = c.evaluation?.score ?? 0;
    if (scoreFilter === '85plus') matchesScore = score >= 85;
    else if (scoreFilter === '70to84') matchesScore = score >= 70 && score < 85;
    else if (scoreFilter === 'under70') matchesScore = score < 70;

    return matchesSearch && matchesDept && matchesScore;
  }).sort((a, b) => {
    if (sortBy === 'score') {
      return (b.evaluation?.score ?? 0) - (a.evaluation?.score ?? 0);
    }
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  // Stats calculation
  const totalCount = candidates.length;
  const avgScore = totalCount > 0
    ? Math.round(candidates.reduce((acc, c) => acc + (c.evaluation?.score ?? 0), 0) / totalCount)
    : 0;
  const eemCount = candidates.filter(c => c.department === 'eem').length;
  const makineCount = candidates.filter(c => c.department === 'makine').length;
  const compCount = candidates.filter(c => c.department === 'bilgisayar').length;

  // Language switch component
  const LanguageToggle = () => (
    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
      {(['az', 'tr', 'en'] as Language[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => changeLanguage(l)}
          className={`px-2.5 py-1 rounded transition-colors ${
            lang === l
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  // If checking authentication on load
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  // LOGIN SCREEN (Strictly locked until password is typed)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4">
        {/* Language switch top-right */}
        <div className="absolute top-6 right-6">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl relative">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-center text-white mb-2">{t.loginTitle}</h1>
          <p className="text-xs text-center text-slate-400 mb-6">
            {t.loginSub}
          </p>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                {t.passwordLabel}
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {loggingIn ? t.loggingIn : t.loginBtn}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {t.backToHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-[#0c121e] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide">{t.portalTitle}</div>
              <div className="text-xs text-emerald-400 font-mono">{t.portalSub}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <LanguageToggle />

            {/* CSV Export */}
            <a
              href="/api/admin/candidates?format=csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              title={t.exportCsv}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.exportCsv}</span>
            </a>

            {/* Refresh */}
            <button
              onClick={() => fetchCandidates()}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title={t.refresh}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors"
              title={t.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>{t.totalApplications}</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{totalCount}</div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>{t.avgScore}</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">{avgScore} / 100</div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>{t.eemCount}</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-300 font-mono">{eemCount}</div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>{t.mechCompCount}</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-300 font-mono">
              {makineCount} / {compCount}
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-emerald-500"
            >
              <option value="all">{t.allDepartments}</option>
              <option value="eem">{t.deptEem}</option>
              <option value="makine">{t.deptMakine}</option>
              <option value="bilgisayar">{t.deptBilgisayar}</option>
              <option value="diger">{t.deptDiger}</option>
            </select>

            {/* Score Filter */}
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-emerald-500"
            >
              <option value="all">{t.allScores}</option>
              <option value="85plus">{t.score85}</option>
              <option value="70to84">{t.score70}</option>
              <option value="under70">{t.scoreUnder70}</option>
            </select>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(prev => prev === 'score' ? 'date' : 'score')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-slate-300 hover:text-white"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>{sortBy === 'score' ? t.sortByScore : t.sortByDate}</span>
            </button>
          </div>
        </div>

        {/* CANDIDATES TABLE / LIST */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              {t.noCandidates}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#090d16]/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">{t.thCandidate}</th>
                    <th className="py-3 px-4">{t.thDept}</th>
                    <th className="py-3 px-4">{t.thScore}</th>
                    <th className="py-3 px-4">{t.thTeam}</th>
                    <th className="py-3 px-4">{t.thRisk}</th>
                    <th className="py-3 px-4">{t.thContact}</th>
                    <th className="py-3 px-4 text-right">{t.thActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCandidates.map((c) => {
                    const score = c.evaluation?.score ?? 0;
                    const scoreColor =
                      score >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      score >= 70 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      'text-slate-400 bg-slate-800 border-slate-700';

                    const aiRisk = c.evaluation?.aiCopyLikelihood || 'low';
                    const riskBadge =
                      aiRisk === 'high' ? 'text-red-400 bg-red-950/50 border-red-500/30' :
                      aiRisk === 'medium' ? 'text-amber-400 bg-amber-950/50 border-amber-500/30' :
                      'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';

                    const riskText =
                      aiRisk === 'high' ? t.riskHigh :
                      aiRisk === 'medium' ? t.riskMedium :
                      t.riskLow;

                    const cleanPhone = c.phone.replace(/[^0-9]/g, '');

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Name & Group */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{c.fullName}</div>
                          <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                            {t.groupLabel}: {c.groupNo} • {t.langLabel}: {c.language.toUpperCase()}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium uppercase bg-slate-900 border border-slate-800 text-slate-300">
                            {c.department}
                          </span>
                        </td>

                        {/* AI Score */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border font-mono ${scoreColor}`}>
                            {score} / 100
                          </span>
                        </td>

                        {/* Recommended Subteam */}
                        <td className="py-3 px-4">
                          <span className="text-slate-200 font-medium">
                            {c.evaluation?.recommendedSubTeam || '—'}
                          </span>
                        </td>

                        {/* AI Copy Risk */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${riskBadge}`}>
                            {riskText}
                          </span>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {c.phone}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* View Detail Modal */}
                            <button
                              onClick={() => setSelectedCandidate(c)}
                              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t.btnView}</span>
                            </button>

                            {/* WhatsApp link */}
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-md bg-emerald-950/60 hover:bg-emerald-800 text-emerald-400 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(c.id, c.fullName)}
                              className="p-1 rounded-md bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition-colors"
                              title={t.btnDelete}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="text-xl font-bold text-white">{selectedCandidate.fullName}</div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  {t.groupLabel}: {selectedCandidate.groupNo} • {t.thDept}: {selectedCandidate.department.toUpperCase()} • {t.thContact}: {selectedCandidate.phone}
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Evaluation Summary Card */}
            <div className="bg-[#090d16] border border-emerald-500/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <BrainCircuit className="w-4 h-4" />
                  <span>{t.modalAiReport}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-sm">
                  {t.modalScore}: {selectedCandidate.evaluation?.score ?? 0} / 100
                </div>
              </div>

              {/* Executive Summary */}
              {selectedCandidate.evaluation?.executiveSummary && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.modalSummary}</div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                    {selectedCandidate.evaluation.executiveSummary.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths & Fit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800">
                <div>
                  <span className="font-semibold text-emerald-400">{t.modalRecommendedTeam}</span>{' '}
                  <span className="text-slate-200">{selectedCandidate.evaluation?.recommendedSubTeam || '—'}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-400">{t.modalAiRisk}</span>{' '}
                  <span className="text-slate-200 uppercase">{selectedCandidate.evaluation?.aiCopyLikelihood}</span>
                </div>
              </div>

              {selectedCandidate.evaluation?.departmentFitAnalysis && (
                <div className="text-xs text-slate-400 italic pt-1 border-t border-slate-800/60">
                  &ldquo;{selectedCandidate.evaluation.departmentFitAnalysis}&rdquo;
                </div>
              )}
            </div>

            {/* Full Questions & Answers */}
            <div className="space-y-4">
              <div className="text-sm font-bold text-white uppercase tracking-wider">
                {t.modalResponsesTitle}
              </div>

              {/* Q1 */}
              <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-bold text-emerald-300 mb-1">
                  {t.modalQ1}
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedCandidate.answers.q1_failsafe}
                </div>
              </div>

              {/* Q2 */}
              <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-bold text-emerald-300 mb-1">
                  {t.modalQ2}
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedCandidate.answers.q2_learning}
                </div>
              </div>

              {/* Q3 */}
              <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-bold text-emerald-300 mb-1">
                  {t.modalQ3}
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedCandidate.answers.q3_crisis}
                </div>
              </div>

              {/* Q4 */}
              <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-bold text-emerald-300 mb-1">
                  {t.modalQ4}
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedCandidate.answers.q4_commitment}
                </div>
              </div>

              {/* Q5 */}
              <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-bold text-emerald-300 mb-1">
                  {t.modalQ5}
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedCandidate.answers.q5_specialSkills || t.modalNotSpecified}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <a
                href={`https://wa.me/${selectedCandidate.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.modalWhatsapp}</span>
              </a>

              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                {t.modalClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
