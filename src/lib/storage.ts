import fs from 'fs';
import path from 'path';
import { CandidateSubmission } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'candidates.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
  }
}

export function getAllCandidates(): CandidateSubmission[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read candidates file:', err);
    return [];
  }
}

export function saveCandidate(candidate: CandidateSubmission): boolean {
  try {
    ensureDataFile();
    const list = getAllCandidates();
    // Add to beginning of array
    list.unshift(candidate);
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save candidate:', err);
    return false;
  }
}

export function deleteCandidate(id: string): boolean {
  try {
    ensureDataFile();
    const list = getAllCandidates();
    const filtered = list.filter(c => c.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to delete candidate:', err);
    return false;
  }
}
