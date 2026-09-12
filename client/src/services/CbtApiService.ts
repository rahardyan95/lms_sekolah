import { api } from '../lib/ApiClient';

export type CbtOptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ServerExamSummary {
  id: string;
  title: string;
  subject_name: string;
  kelas: string;
  duration_minutes: number;
  total_questions: number;
  date: string;
  time_start: string;
  time_end: string;
  status: string;
  is_open: boolean;
}

export interface ServerAttemptQuestion {
  id: string;
  number: number;
  question: string;
  options: Record<CbtOptionKey, string>;
  answer?: CbtOptionKey | null;
  hesitant?: boolean;
  correct_answer?: CbtOptionKey;
  explanation?: string | null;
}

export interface ServerAttempt {
  id: string;
  exam_id: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  score: number | null;
  seconds_remaining: number;
  questions: ServerAttemptQuestion[];
}

export interface ServerGradeResult {
  correct: number;
  wrong: number;
  total: number;
  score: number;
}

/** Satu butir soal A–E untuk pembuatan ujian (StoreCbtExamRequest). */
export interface CbtQuestionInput {
  question: string;
  options: Record<CbtOptionKey, string>;
  correct_answer: CbtOptionKey;
  explanation?: string;
}

/**
 * Payload pembuatan ujian — cermin persis StoreCbtExamRequest:
 * title/subject_name/kelas/duration_minutes/date/time_start/time_end wajib,
 * questions wajib 1–100 butir dengan opsi A–E + kunci.
 */
export interface CreateExamPayload {
  title: string;
  subject_name: string;
  kelas: string;
  duration_minutes: number;
  date: string;
  time_start: string;
  time_end: string;
  status?: 'draft' | 'published' | 'closed';
  questions: CbtQuestionInput[];
}

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

/**
 * OOP client CBT server-side. Dipakai saat token tersedia (siswa login);
 * tanpa token / API mati → modul memakai mock lokal (DEV fallback).
 */
export class CbtApiService {
  static async listExams(): Promise<ServerExamSummary[]> {
    const res = await api.get('/cbt/exams');
    return unwrap<ServerExamSummary[]>(res);
  }

  /** Buat ujian + soal (guru/admin). Respons 201 berisi ringkasan ujian. */
  static async createExam(payload: CreateExamPayload): Promise<ServerExamSummary> {
    const res = await api.post('/cbt/exams', payload);
    return unwrap<ServerExamSummary>(res);
  }

  static async startAttempt(examId: string): Promise<ServerAttempt> {
    const res = await api.post(`/cbt/exams/${examId}/attempts`);
    return unwrap<ServerAttempt>(res);
  }

  static async saveAnswer(
    attemptId: string,
    questionId: string,
    answer: CbtOptionKey,
    hesitant: boolean,
  ): Promise<void> {
    await api.patch(`/cbt/attempts/${attemptId}/answers`, {
      question_id: questionId,
      answer,
      hesitant,
    });
  }

  static async submitAttempt(attemptId: string): Promise<ServerGradeResult> {
    const res = await api.post(`/cbt/attempts/${attemptId}/submit`);
    const data = unwrap<{ correct: number; wrong: number; total: number; score: number }>(res);
    return { correct: data.correct, wrong: data.wrong, total: data.total, score: data.score };
  }
}
