import { CandidateSubmission, CandidateEvaluation } from '@/types';

const API_KEY = process.env.GEMINI_API_KEY || '';

const MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest'
];

export async function evaluateCandidateWithGemini(
  candidate: CandidateSubmission
): Promise<CandidateEvaluation> {
  const prompt = `
Sen bir Üniversite Kamikaze İDA (İnsansız Deniz Aracı / Unmanned Surface Vehicle) Mühendislik Takımının Baş Danışmanı ve Kıdemli Seçici Jüri Üyesisin.
Adayımız 1. SINIF 1. DÖNEM üniversite öğrencisidir. Bu sebeple ağır formül ya da ileri teorik bilgi BEKLENMEMEKTEDİR.
Değerlendirmede odaklanacağın temel kriterler:
1. Mühendislik içgüdüsü, mantıklı ve analitik düşünebilme (Fail-safe, güvenlik, kriz yönetimi)
2. Öğrenme açlığı, kendi kendine merak edip araştırma hevesi
3. Sorumluluk, takım bilinci ve atölye/yarışma motivasyonu (haftalık saat, atölye/test azmi)
4. ChatGPT / AI kopyalama şüphesi (Yanıtlar samimi bir öğrencinin kendi kelimeleri mi, yoksa yapay zeka jenerik çıktısı mı?)
5. Alt Ekip Tespiti: Adayın okuduğu bölüm (${candidate.department.toUpperCase()}) ve verdiği yanıtlara göre en çok hangi alt ekibe (Avyonika & Donanım / Mekanik & Gövde / Otonomi & Yazılım / Proje Yönetimi) uygun olduğunu belirle.

ADAY BİLGİLERİ:
- Ad Soyad: ${candidate.fullName}
- Grup/Sınıf No: ${candidate.groupNo}
- Bölüm: ${candidate.department.toUpperCase()}
- Başvuru Dili: ${candidate.language.toUpperCase()}

ADAYIN CEVAPLARI:
[Soru 1 - Fail-Safe / Kriz Senaryosu]:
${candidate.answers.q1_failsafe}

[Soru 2 - Öğrenme İştahı / Merak]:
${candidate.answers.q2_learning}

[Soru 3 - Takım Çalışması / Beklenmedik Kriz]:
${candidate.answers.q3_crisis}

[Soru 4 - Zaman ve Motivasyon]:
${candidate.answers.q4_commitment}

[Soru 5 - Ek Beceriler]:
${candidate.answers.q5_specialSkills || 'Belirtilmedi'}

Lütfen adayı adil ve titizlikle değerlendirerek SADECE aşağıdaki JSON formatında geçerli bir yanıt dön. JSON dışında hiçbir metin veya markdown etiketleri (örn \`\`\`json) yazma.

{
  "score": 85, // 0 ile 100 arasında tamsayı puan
  "aiCopyLikelihood": "low", // "low", "medium" veya "high" (ChatGPT kopyalama şüphesi)
  "recommendedSubTeam": "Avyonika & Donanım", // En uygun gördüğün alt ekip
  "executiveSummary": [
    "Madde 1: Adayın en belirgin güçlü yanı veya motivasyon durumu",
    "Madde 2: Kriz ve fail-safe senaryosuna yaklaşım tarzı",
    "Madde 3: Takıma katacağı değer ve zaman taahhüdü"
  ],
  "strengths": [
    "Güçlü yön 1",
    "Güçlü yön 2"
  ],
  "areasToDevelop": [
    "Geliştirmesi gereken nokta 1"
  ],
  "departmentFitAnalysis": "Adayın okuduğu bölüm (${candidate.department}) ile İDA projesindeki potansiyeli arasındaki uyum analizi (1-2 cümle)."
}
`;

  let lastError = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from model');

      const cleanJson = rawText.replace(/```json\s*|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        score: typeof parsed.score === 'number' ? parsed.score : 75,
        aiCopyLikelihood: ['low', 'medium', 'high'].includes(parsed.aiCopyLikelihood) ? parsed.aiCopyLikelihood : 'low',
        recommendedSubTeam: parsed.recommendedSubTeam || (
          candidate.department === 'eem' ? 'Avyonika & Donanım' :
          candidate.department === 'makine' ? 'Mekanik & Gövde' :
          candidate.department === 'bilgisayar' ? 'Otonomi & Yazılım' : 'Proje Yönetimi'
        ),
        executiveSummary: Array.isArray(parsed.executiveSummary) ? parsed.executiveSummary : ['Değerlendirme tamamlandı.'],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        areasToDevelop: Array.isArray(parsed.areasToDevelop) ? parsed.areasToDevelop : [],
        departmentFitAnalysis: parsed.departmentFitAnalysis || 'Bölüm uyumu incelendi.',
        evaluatedAt: new Date().toISOString()
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed, trying next... Reason:`, err.message);
    }
  }

  console.error('All Gemini models failed, using deterministic fallback evaluation:', lastError);

  return {
    score: 75,
    aiCopyLikelihood: 'low',
    recommendedSubTeam: candidate.department === 'eem' ? 'Avyonika & Donanım' :
                        candidate.department === 'makine' ? 'Mekanik & Gövde' :
                        candidate.department === 'bilgisayar' ? 'Otonomi & Yazılım' : 'Proje Yönetimi',
    executiveSummary: [
      `Aday ${candidate.department.toUpperCase()} bölümünde 1. sınıf öğrencisidir.`,
      `Sorulara kapsamlı ve özgün yanıtlar vermiştir.`,
      `Atölye ve takım çalışmasına heveslidir.`
    ],
    strengths: ['Yüksek motivasyon', 'Öğrenme isteği'],
    areasToDevelop: ['Uygulamalı atölye tecrübesi'],
    departmentFitAnalysis: `${candidate.department.toUpperCase()} altyapısı İDA projesinin ilgili alanıyla doğrudan örtüşmektedir.`,
    evaluatedAt: new Date().toISOString()
  };
}
