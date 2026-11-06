import { NextRequest, NextResponse } from 'next/server';
import { getAllCandidates, deleteCandidate } from '@/lib/storage';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aztuida2026';

function isAuthorized(req: NextRequest): boolean {
  const cookie = req.cookies.get('admin_auth')?.value;
  const authHeader = req.headers.get('authorization');
  return (
    cookie === 'aztu_admin_authenticated_2026' ||
    authHeader === `Bearer ${ADMIN_PASSWORD}` ||
    authHeader === 'Bearer aztu_admin_authenticated_2026'
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'İcazəsiz giriş' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  const candidates = await getAllCandidates();

  if (format === 'csv') {
    const headers = [
      'ID',
      'Tarix',
      'Dil',
      'Ad Soyad',
      'Qrup No',
      'Bölüm',
      'Telefon',
      'AI Balı',
      'AI Tövsiyə Alt Ekip',
      'AI Kopya Riski',
      'Fail-Safe Cavabı',
      'Öyrənmə Cavabı',
      'Böhran Cavabı',
      'Vaxt Cavabı',
      'Əlavə Bacarıqlar'
    ];

    const rows = candidates.map(c => [
      `"${c.id}"`,
      `"${c.submittedAt}"`,
      `"${c.language}"`,
      `"${c.fullName.replace(/"/g, '""')}"`,
      `"${c.groupNo.replace(/"/g, '""')}"`,
      `"${c.department}"`,
      `"${c.phone}"`,
      c.evaluation?.score ?? '',
      `"${(c.evaluation?.recommendedSubTeam || '').replace(/"/g, '""')}"`,
      `"${c.evaluation?.aiCopyLikelihood || ''}"`,
      `"${(c.answers.q1_failsafe || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(c.answers.q2_learning || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(c.answers.q3_crisis || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(c.answers.q4_commitment || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(c.answers.q5_specialSkills || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kamikaze_ida_namizedler_${Date.now()}.csv"`
      }
    });
  }

  return NextResponse.json({
    success: true,
    total: candidates.length,
    candidates
  });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'İcazəsiz giriş' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Namizəd ID tələb olunur' }, { status: 400 });
    }

    const success = await deleteCandidate(id);
    return NextResponse.json({ success });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Silmə xətası' }, { status: 500 });
  }
}
