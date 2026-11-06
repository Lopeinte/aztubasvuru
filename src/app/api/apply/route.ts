import { NextRequest, NextResponse } from 'next/server';
import { CandidateSubmission } from '@/types';
import { evaluateCandidateWithGemini } from '@/lib/gemini';
import { saveCandidate } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      language = 'az',
      fullName,
      groupNo,
      department,
      phone,
      answers
    } = body;

    // Strict validation of mandatory fields
    if (!fullName?.trim() || !groupNo?.trim() || !department || !phone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Məcburi sahələri doldurun / Zorunlu alanları doldurun.' },
        { status: 400 }
      );
    }

    if (
      !answers?.q1_failsafe?.trim() ||
      !answers?.q2_learning?.trim() ||
      !answers?.q3_crisis?.trim() ||
      !answers?.q4_commitment?.trim()
    ) {
      return NextResponse.json(
        { success: false, error: 'Bütün sualları cavablandırmağınız vacibdir.' },
        { status: 400 }
      );
    }

    const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newCandidate: CandidateSubmission = {
      id: candidateId,
      submittedAt: new Date().toISOString(),
      language: ['az', 'tr', 'en'].includes(language) ? language : 'az',
      fullName: fullName.trim(),
      groupNo: groupNo.trim(),
      department,
      phone: phone.trim(),
      answers: {
        q1_failsafe: answers.q1_failsafe.trim(),
        q2_learning: answers.q2_learning.trim(),
        q3_crisis: answers.q3_crisis.trim(),
        q4_commitment: answers.q4_commitment.trim(),
        q5_specialSkills: (answers.q5_specialSkills || '').trim()
      }
    };

    // Run AI Evaluation with Gemini
    const evaluation = await evaluateCandidateWithGemini(newCandidate);
    newCandidate.evaluation = evaluation;

    // Save candidate to secure storage
    const saved = saveCandidate(newCandidate);
    if (!saved) {
      throw new Error('Müraciəti yaddaşa yazmaq mümkün olmadı.');
    }

    // Return success to applicant WITHOUT exposing AI scores or other private data
    return NextResponse.json({
      success: true,
      message: 'Müraciətiniz qeydə alındı. Təşəkkür edirik!'
    });
  } catch (err: any) {
    console.error('API /apply error:', err);
    return NextResponse.json(
      { success: false, error: 'Xəta baş verdi. Zəhmət olmasa bir qədər sonra yenidən cəhd edin.' },
      { status: 500 }
    );
  }
}
