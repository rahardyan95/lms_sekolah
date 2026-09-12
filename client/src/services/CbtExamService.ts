import type { CbtExam, CbtQuestion } from '../types';

/**
 * OOP service sanitasi keamanan bundle CBT.
 * Aturan: bundle TIDAK boleh membawa correctAnswer/explanation.
 * Grading resmi hanya di server (CbtApiService.submitAttempt).
 * Mode latihan lokal tidak memberi nilai.
 */

/** Tipe publik tanpa kunci — yang boleh dirender di daftar & dikirim ke browser. */
export type CbtQuestionPublic = Omit<CbtQuestion, 'correctAnswer' | 'explanation'>;

export class CbtExamSecurityService {
  /**
   * Buang kunci + pembahasan untuk tampilan daftar/kartu (defense-in-depth;
   * bundle mock sudah tanpa kunci — guard assertNoKeysInProd menegakkannya).
   */
  static sanitizeForList(exams: CbtExam[]): Array<Omit<CbtExam, 'questions'> & { questions: CbtQuestionPublic[]; questionCount: number }> {
    return exams.map((exam) => ({
      ...exam,
      questions: exam.questions.map((q) => CbtExamSecurityService.stripKey(q)),
      questionCount: exam.questions.length,
    }));
  }

  static stripKey(q: CbtQuestion): CbtQuestionPublic {
    const { correctAnswer: _k, explanation: _e, ...pub } = q;
    return pub;
  }

  /** True bila exam masih membawa kunci ke browser (harus selalu false). */
  static hasAnswerKeyLeak(exams: CbtExam[]): boolean {
    return exams.some((exam) =>
      exam.questions.some((q) => q.correctAnswer !== undefined && q.correctAnswer !== null),
    );
  }

  /**
   * Guard build: gagalkan produksi bila kunci masih di bundle.
   * Dipanggil di build (vite plugin pre-check) agar go-live tidak diam-diam bocor.
   */
  static assertNoKeysInProd(exams: CbtExam[]): void {
    if (!import.meta.env.PROD) return;
    if (CbtExamSecurityService.hasAnswerKeyLeak(exams)) {
      throw new Error(
        '[CBT-SECURITY] P0: answer key masih di bundle frontend. ' +
          'Build produksi dibatalkan — pindahkan grading ke server (PRD CBT-001..007).',
      );
    }
  }
}
