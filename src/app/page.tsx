'use client';

import React, { useState } from 'react';
import { translations } from '@/lib/translations';
import { Language, Department } from '@/types';
import {
  Compass,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  BrainCircuit,
  Sparkles
} from 'lucide-react';

export default function ApplicationPage() {
  const [lang, setLang] = useState<Language>('az');
  const t = translations[lang];

  // Form State
  const [fullName, setFullName] = useState('');
  const [groupNo, setGroupNo] = useState('');
  const [department, setDepartment] = useState<Department>('eem');
  const [phone, setPhone] = useState('');

  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [q4, setQ4] = useState('');
  const [q5, setQ5] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim() || !groupNo.trim() || !phone.trim()) {
      setErrorMsg(t.errorRequired);
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }

    if (!q1.trim() || !q2.trim() || !q3.trim() || !q4.trim()) {
      setErrorMsg(t.errorRequired);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          fullName,
          groupNo,
          department,
          phone,
          answers: {
            q1_failsafe: q1,
            q2_learning: q2,
            q3_crisis: q3,
            q4_commitment: q4,
            q5_specialSkills: q5
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xəta baş verdi');
      }

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Müraciət göndərilərkən xəta baş verdi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setGroupNo('');
    setDepartment('eem');
    setPhone('');
    setQ1('');
    setQ2('');
    setQ3('');
    setQ4('');
    setQ5('');
    setIsSuccess(false);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">AzTU KAMİKAZE İDA</div>
              <div className="text-xs text-slate-400 font-mono">TƏLƏBƏ LAYİHƏSİ</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
              {(['az', 'tr', 'en'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    lang === l
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">
        {isSuccess ? (
          <div className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-8 sm:p-12 text-center my-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              {t.successTitle}
            </h2>
            <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
              {t.successDesc}
            </p>
            <div className="inline-flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                {t.backToHome}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Header info */}
            <div className="mb-8 text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {t.heading}
              </h1>
            </div>

            {errorMsg && (
              <div className="mb-8 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-10">
              {/* SECTION 1: Personal Info */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-2.5 pb-4 mb-6 border-b border-slate-800">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">{t.section1Title}</h2>
                    <p className="text-xs text-slate-400">{t.section1Desc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      {t.fullNameLabel} <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t.fullNamePlaceholder}
                      className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Group / Class No */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      {t.groupNoLabel} <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={groupNo}
                      onChange={(e) => setGroupNo(e.target.value)}
                      placeholder={t.groupNoPlaceholder}
                      className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      {t.departmentLabel} <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value as Department)}
                      className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white focus:border-emerald-500 transition-colors"
                    >
                      <option value="eem">{t.deptEem}</option>
                      <option value="makine">{t.deptMakine}</option>
                      <option value="bilgisayar">{t.deptBilgisayar}</option>
                      <option value="diger">{t.deptDiger}</option>
                    </select>
                  </div>

                  {/* Phone / WhatsApp */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      {t.phoneLabel} <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t.phonePlaceholder}
                      className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Analytical & Mindset Questions */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-8">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                  <BrainCircuit className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">{t.section2Title}</h2>
                    <p className="text-xs text-slate-400">{t.section2Desc}</p>
                  </div>
                </div>

                {/* Q1: Fail-Safe */}
                <div>
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">{t.q1Title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t.q1Desc}</p>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={q1}
                    onChange={(e) => setQ1(e.target.value)}
                    placeholder={t.q1Placeholder}
                    className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-right text-[11px] text-slate-500 mt-1 font-mono">{q1.length} simvol</div>
                </div>

                {/* Q2: Learning */}
                <div>
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">{t.q2Title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t.q2Desc}</p>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={q2}
                    onChange={(e) => setQ2(e.target.value)}
                    placeholder={t.q2Placeholder}
                    className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-right text-[11px] text-slate-500 mt-1 font-mono">{q2.length} simvol</div>
                </div>

                {/* Q3: Crisis & Teamwork */}
                <div>
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">{t.q3Title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t.q3Desc}</p>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={q3}
                    onChange={(e) => setQ3(e.target.value)}
                    placeholder={t.q3Placeholder}
                    className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-right text-[11px] text-slate-500 mt-1 font-mono">{q3.length} simvol</div>
                </div>

                {/* Q4: Commitment (Without Night Mention) */}
                <div>
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">{t.q4Title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t.q4Desc}</p>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={q4}
                    onChange={(e) => setQ4(e.target.value)}
                    placeholder={t.q4Placeholder}
                    className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-right text-[11px] text-slate-500 mt-1 font-mono">{q4.length} simvol</div>
                </div>

                {/* Q5: Extra Skills */}
                <div>
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">{t.q5Title}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t.q5Desc}</p>
                  </div>
                  <textarea
                    rows={3}
                    value={q5}
                    onChange={(e) => setQ5(e.target.value)}
                    placeholder={t.q5Placeholder}
                    className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-right text-[11px] text-slate-500 mt-1 font-mono">{q5.length} simvol</div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 text-center sm:text-right">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-950/40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t.submittingBtn}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.submitBtn}</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c121e] py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4">
          <p>{t.footerText}</p>
          <div className="mt-2 text-slate-600 font-mono">
            Azərbaycan Texniki Universiteti (AzTU) • Mühəndislik Tələbə Klubu
          </div>
        </div>
      </footer>
    </div>
  );
}
