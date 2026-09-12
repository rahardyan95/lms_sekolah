import { api } from '../lib/ApiClient';

export interface ServerSubject {
  id: string;
  code: string;
  name: string;
  category: string;
  kkm: number;
}

export interface ServerSchedule {
  id: string;
  day: string;
  time_start: string;
  time_end: string;
  kelas: string;
  subject_name: string;
  teacher_name: string;
  room: string | null;
}

export interface ServerAnnouncement {
  id: string;
  title: string;
  content: string;
  target_role: string;
  is_important: boolean;
  date?: string;
  created_at: string;
}

function unwrapPage<T>(res: { data: { data: { data?: T[] } | T[] } }): T[] {
  const page = res.data.data;
  return Array.isArray(page) ? page : page.data ?? [];
}

/** OOP client Akademik. Tanpa token → modul memakai mock lokal. */
export class AcademicApiService {
  static async subjects(): Promise<ServerSubject[]> {
    const res = await api.get('/lms/subjects');
    return unwrapPage<ServerSubject>(res);
  }

  static async bulkGrades(
    subjectId: string,
    rows: Array<{ student_id: string; nilai_tugas: number; nilai_uts: number; nilai_uas: number; catatan_guru?: string }>,
    publish: boolean,
  ): Promise<{ created: number; updated: number }> {
    const res = await api.post(`/lms/subjects/${subjectId}/grades/bulk`, { rows, publish });
    return res.data.data as { created: number; updated: number };
  }

  static async schedules(kelas = ''): Promise<ServerSchedule[]> {
    const res = await api.get('/academic/schedules', { params: { kelas } });
    return unwrapPage<ServerSchedule>(res);
  }

  static async announcements(): Promise<ServerAnnouncement[]> {
    const res = await api.get('/academic/announcements');
    return unwrapPage<ServerAnnouncement>(res);
  }

  static async createAnnouncement(input: {
    title: string;
    content: string;
    target_role: string;
    is_important: boolean;
    published: boolean;
  }): Promise<ServerAnnouncement> {
    const res = await api.post('/academic/announcements', input);
    return res.data.data as ServerAnnouncement;
  }

  // --- Tahun akademik (aktivasi eksklusif: tepat satu aktif) ---
  static async years(): Promise<ServerAcademicYear[]> {
    const res = await api.get('/academic/years');
    return res.data.data as ServerAcademicYear[];
  }

  static async createYear(input: {
    label: string;
    starts_at: string;
    ends_at: string;
    active?: boolean;
  }): Promise<ServerAcademicYear> {
    const res = await api.post('/academic/years', input);
    return res.data.data as ServerAcademicYear;
  }

  static async updateYear(
    id: string,
    input: { label?: string; starts_at?: string; ends_at?: string },
  ): Promise<ServerAcademicYear> {
    const res = await api.put(`/academic/years/${id}`, input);
    return res.data.data as ServerAcademicYear;
  }

  static async activateYear(id: string): Promise<ServerAcademicYear> {
    const res = await api.post(`/academic/years/${id}/activate`);
    return res.data.data as ServerAcademicYear;
  }

  static async deleteYear(id: string): Promise<void> {
    await api.delete(`/academic/years/${id}`);
  }

  // --- Jadwal pelajaran (anti-bentrok di server: 409) ---
  static async createSchedule(input: {
    day: string;
    time_start: string;
    time_end: string;
    kelas: string;
    subject_id?: string | null;
    subject_name: string;
    teacher_name: string;
    room?: string;
  }): Promise<ServerSchedule> {
    const res = await api.post('/academic/schedules', input);
    return res.data.data as ServerSchedule;
  }

  static async updateSchedule(
    id: string,
    input: Partial<{
      day: string;
      time_start: string;
      time_end: string;
      kelas: string;
      subject_id: string | null;
      subject_name: string;
      teacher_name: string;
      room: string;
    }>,
  ): Promise<ServerSchedule> {
    const res = await api.put(`/academic/schedules/${id}`, input);
    return res.data.data as ServerSchedule;
  }

  static async deleteSchedule(id: string): Promise<void> {
    await api.delete(`/academic/schedules/${id}`);
  }

  static async classes(): Promise<Array<{ id: string; name: string; grade?: string; major?: string }>> {
    const res = await api.get('/academic/classes');
    return res.data.data as Array<{ id: string; name: string; grade?: string; major?: string }>;
  }
}

export interface ServerAcademicYear {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}
