export type Language = 'az' | 'tr' | 'en';

export type Department = 'eem' | 'makine' | 'bilgisayar' | 'diger';

export interface CandidateSubmission {
  id: string;
  submittedAt: string;
  language: Language;
  fullName: string;
  groupNo: string;
  department: Department;
  phone: string;
  subTeamPreference?: string;
  answers: {
    q1_failsafe: string;
    q2_learning: string;
    q3_crisis: string;
    q4_commitment: string;
    q5_specialSkills: string;
  };
  evaluation?: CandidateEvaluation;
}

export interface CandidateEvaluation {
  score: number; // 0 - 100
  aiCopyLikelihood: 'low' | 'medium' | 'high'; // ChatGPT detection
  recommendedSubTeam: string;
  executiveSummary: string[];
  strengths: string[];
  areasToDevelop: string[];
  departmentFitAnalysis: string;
  evaluatedAt: string;
}
