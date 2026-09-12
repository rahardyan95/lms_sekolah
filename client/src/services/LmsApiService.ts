import { api } from '../lib/ApiClient';

export interface ServerMaterial {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  file_type: 'PDF' | 'PPT' | 'DOC' | 'VIDEO';
  kelas: string | null;
  created_at: string;
  /** Link unduh bertanda tangan dari server (berlaku pendek). */
  download_url?: string | null;
  subject?: { id: string; code: string; name: string } | null;
}

export interface ServerAssignment {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  deadline: string;
  kelas: string | null;
  subject?: { id: string; code: string; name: string } | null;
}

export interface ServerGrade {
  id: string;
  nilai_tugas: number | null;
  nilai_uts: number | null;
  nilai_uas: number | null;
  nilai_akhir: number | null;
  predikat: string | null;
  catatan_guru: string | null;
  subject?: { id: string; code: string; name: string } | null;
}

function unwrapPage<T>(res: { data: { data: { data?: T[] } | T[] } }): T[] {
  const page = res.data.data;
  return Array.isArray(page) ? page : page.data ?? [];
}

/** OOP client LMS siswa. Tanpa token → modul memakai mock lokal. */
export class LmsApiService {
  static async materials(): Promise<ServerMaterial[]> {
    const res = await api.get('/lms/materials');
    return unwrapPage<ServerMaterial>(res);
  }

  static async assignments(): Promise<ServerAssignment[]> {
    const res = await api.get('/lms/assignments');
    return unwrapPage<ServerAssignment>(res);
  }

  static async myGrades(): Promise<ServerGrade[]> {
    const res = await api.get('/lms/grades/mine');
    return res.data.data as ServerGrade[];
  }

  static async submitAssignment(assignmentId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    await api.post(`/lms/assignments/${assignmentId}/submissions`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  /**
   * Unduh materi via URL bertanda tangan dari server (`download_url`).
   * Tanpa signature, endpoint akan menolak (403) — jadi URL wajib dari list.
   */
  static async downloadMaterial(downloadUrl: string, filename: string): Promise<void> {
    const res = await api.get(downloadUrl, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Ringkasan header portal siswa (kehadiran bulan ini + rata-rata nilai). */
  static async mySummary(): Promise<ServerStudentSummary> {
    const res = await api.get('/lms/summary/mine');
    return res.data.data as ServerStudentSummary;
  }

  // --- Sisi guru: kelola materi, tugas, dan penilaian ---
  static async storeSubject(input: { code: string; name: string; category?: string; kkm?: number }): Promise<{ id: string }> {
    const res = await api.post('/lms/subjects', input);
    return res.data.data as { id: string };
  }

  static async storeMaterial(input: {
    subject_id?: string | null;
    title: string;
    description?: string;
    file_type: ServerMaterial['file_type'];
    kelas?: string;
    file?: File | null;
  }): Promise<ServerMaterial> {
    const form = new FormData();
    if (input.subject_id) form.append('subject_id', input.subject_id);
    form.append('title', input.title);
    if (input.description) form.append('description', input.description);
    form.append('file_type', input.file_type);
    if (input.kelas) form.append('kelas', input.kelas);
    if (input.file) form.append('file', input.file);

    const res = await api.post('/lms/materials', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as ServerMaterial;
  }

  static async storeAssignment(input: {
    subject_id: string;
    title: string;
    description?: string;
    deadline: string;
    kelas?: string;
  }): Promise<ServerAssignment> {
    const res = await api.post('/lms/assignments', input);
    return res.data.data as ServerAssignment;
  }

  static async submissions(assignmentId: string): Promise<ServerSubmission[]> {
    const res = await api.get(`/lms/assignments/${assignmentId}/submissions`);
    return unwrapPage<ServerSubmission>(res);
  }

  static async gradeSubmission(submissionId: string, score: number | null, feedback?: string): Promise<ServerSubmission> {
    const res = await api.patch(`/lms/submissions/${submissionId}/grade`, { score, feedback });
    return res.data.data as ServerSubmission;
  }
}

export interface ServerStudentSummary {
  nisn: string;
  /** Identitas dari server — dipakai membangun profil saat prop mock tidak ada. */
  name?: string;
  class_name?: string;
  major?: string;
  attendance_percentage: number;
  average_grade: number;
}

export interface ServerSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  original_name: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  student?: { id: string; nisn: string; name: string } | null;
}
