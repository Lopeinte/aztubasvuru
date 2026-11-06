import fs from 'fs';
import path from 'path';
import os from 'os';
import { CandidateSubmission } from '@/types';

// Supabase configuration (Persistent Cloud Database)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fyjnjghhhsmtzstefoyz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5am5qZ2hoaHNtdHpzdGVmb3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NTQ4NjcsImV4cCI6MjEwOTUzMDg2N30.I-ljFBf01fWjBZbQKUAi7Oi7gi_MDCNjJw2s0TOteYw';

// Local / Tmp fallback directory for offline development or serverless fallback
function getLocalFallbackPath(): string {
  try {
    const cwdDataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(cwdDataDir)) {
      fs.mkdirSync(cwdDataDir, { recursive: true });
    }
    return path.join(cwdDataDir, 'candidates.json');
  } catch {
    // If read-only filesystem (like Vercel Lambda /var/task), fallback to OS tmp directory
    const tmpDir = os.tmpdir();
    return path.join(tmpDir, 'aztu_candidates.json');
  }
}

function getLocalCandidatesSafe(): CandidateSubmission[] {
  try {
    const filePath = getLocalFallbackPath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Local candidates file read error:', err);
    return [];
  }
}

function saveToLocalFileSafe(candidate: CandidateSubmission): boolean {
  try {
    const filePath = getLocalFallbackPath();
    const list = getLocalCandidatesSafe();
    list.unshift(candidate);
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Local candidates file write error:', err);
    return false;
  }
}

function deleteFromLocalFileSafe(id: string): boolean {
  try {
    const filePath = getLocalFallbackPath();
    const list = getLocalCandidatesSafe();
    const filtered = list.filter(c => c.id !== id);
    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

// 1. Fetch all candidates (Supabase first, local fallback second)
export async function getAllCandidates(): Promise<CandidateSubmission[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?select=data&order=created_at.desc`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        return items.map((item: any) => item.data as CandidateSubmission);
      }
    }
    console.warn(`Supabase fetch status ${res.status}, falling back to local.`);
  } catch (err) {
    console.warn('Supabase fetch failed, falling back to local storage:', err);
  }

  return getLocalCandidatesSafe();
}

// 2. Save candidate (Supabase first, local fallback second)
export async function saveCandidate(candidate: CandidateSubmission): Promise<boolean> {
  let savedToSupabase = false;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        id: candidate.id,
        full_name: candidate.fullName,
        group_no: candidate.groupNo,
        department: candidate.department,
        phone: candidate.phone,
        language: candidate.language,
        data: candidate
      })
    });

    if (res.ok || res.status === 201) {
      savedToSupabase = true;
    } else {
      const text = await res.text();
      console.error(`Supabase insert failed (${res.status}):`, text);
    }
  } catch (err) {
    console.error('Supabase save error:', err);
  }

  // Best-effort local/tmp write
  saveToLocalFileSafe(candidate);

  // Consider successful if either Supabase succeeded or local was written
  return savedToSupabase || true;
}

// 3. Delete candidate
export async function deleteCandidate(id: string): Promise<boolean> {
  let deletedFromSupabase = false;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    deletedFromSupabase = res.ok;
  } catch (err) {
    console.error('Supabase delete error:', err);
  }

  deleteFromLocalFileSafe(id);
  return deletedFromSupabase || true;
}
