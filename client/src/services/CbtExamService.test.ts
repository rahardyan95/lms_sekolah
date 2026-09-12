import { describe, expect, it } from 'vitest';
import { CbtExamSecurityService } from './CbtExamService';
import type { CbtExam } from '../types';

function examWithKey(): CbtExam {
  return {
    id: 'CBT-X',
    title: 'Latihan',
    subjectName: 'Matematika',
    kelas: 'X RPL 1',
    durationMinutes: 60,
    totalQuestions: 1,
    date: '2026-09-11',
    timeStart: '08:00',
    timeEnd: '09:00',
    status: 'Sedang Berlangsung',
    questions: [
      {
        id: 1,
        question: 'Q?',
        options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
        correctAnswer: 'B',
        explanation: 'karena B',
      },
    ],
  };
}

describe('CbtExamSecurityService', () => {
  it('mendeteksi kebocoran kunci di bundle', () => {
    expect(CbtExamSecurityService.hasAnswerKeyLeak([examWithKey()])).toBe(true);
  });

  it('lolos bila soal tanpa kunci (bundle produksi)', () => {
    const clean: CbtExam = {
      ...examWithKey(),
      questions: [
        { id: 1, question: 'Q?', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' } },
      ],
    };
    expect(CbtExamSecurityService.hasAnswerKeyLeak([clean])).toBe(false);
  });

  it('sanitizeForList membuang kunci sebelum render daftar', () => {
    const [sanitized] = CbtExamSecurityService.sanitizeForList([examWithKey()]);
    expect(sanitized.questionCount).toBe(1);
    expect('correctAnswer' in sanitized.questions[0]).toBe(false);
    expect('explanation' in sanitized.questions[0]).toBe(false);
  });
});
