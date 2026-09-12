import { api } from '../lib/ApiClient';
import type { AttendanceRecord, AttendanceStatus, Student } from '../types';
import type { ServerSummary } from './FinanceApiService';
import type { ServerGrade } from './LmsApiService';

/** Baris /students dari server (StudentResource) — field PII tidak pernah dikirim API. */
interface ServerStudentRow {
  id: string;
  nisn: string;
  name: string;
  gender?: string | null;
  class?: string | null;
  major?: string | null;
}

/**
 * Baris server → bentuk Student UI. Field yang memang tidak diekspos API
 * (NIK, foto, data orang tua, alamat) dibiarkan kosong secara jujur,
 * bukan dikarang — kartu KTS menampilkan NIK termask dan foto placeholder.
 */
function toStudent(row: ServerStudentRow): Student {
  return {
    id: row.id,
    nisn: row.nisn,
    nik: '',
    name: row.name,
    gender: row.gender === 'P' ? 'P' : 'L',
    kelas: row.class ?? '-',
    jurusan: row.major ?? '-',
    angkatan: '',
    parentName: '',
    parentPhone: '',
    photo: '',
    birthDate: '',
    birthPlace: '',
    address: '',
  };
}

export class StudentService {
  static async list(search = ''): Promise<Student[]> {
    const res = await api.get('/students', { params: { search, per_page: 25 } });
    return (res.data.data as ServerStudentRow[]).map(toStudent);
  }
}

interface ServerAttendanceRow {
  id: string;
  student_id: string;
  nisn?: string;
  student_name?: string;
  kelas?: string;
  date: string;
  time_in: string | null;
  time_out?: string | null;
  status: string;
  source?: string;
}

const SERVER_STATUS: Record<string, AttendanceStatus> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

export class AttendanceMapper {
  /** Server (lowercase) → tampilan. Lookup nama/kelas dari cache siswa lokal bila perlu. */
  static toRecord(row: ServerAttendanceRow, lookup?: Student[]): AttendanceRecord {
    const student = lookup?.find((s) => s.nisn === row.nisn);
    const status = SERVER_STATUS[row.status] ?? 'Hadir';
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      nisn: row.nisn ?? student?.nisn ?? '',
      studentName: row.student_name ?? student?.name ?? row.nisn ?? 'Siswa',
      kelas: row.kelas ?? student?.kelas ?? '-',
      date: String(row.date).slice(0, 10),
      timeIn: row.time_in ? String(row.time_in).slice(0, 5) : '-',
      status,
      notes: row.source === 'qr' ? 'Presensi scan QR (server)' : undefined,
    };
  }
}

export class AttendanceService {
  static async scan(nisn: string, date: string, lookup?: Student[]): Promise<AttendanceRecord> {
    const res = await api.post('/attendance/scans', {
      nisn,
      date,
      idempotency_key: `${nisn}-${date}-${Date.now()}`,
    });
    return AttendanceMapper.toRecord(res.data.data as ServerAttendanceRow, lookup);
  }

  static async reports(from: string, to: string, lookup?: Student[]): Promise<AttendanceRecord[]> {
    const res = await api.get('/attendance/reports', { params: { from, to } });
    const page = res.data.data as { data?: ServerAttendanceRow[] } | ServerAttendanceRow[];
    const rows = Array.isArray(page) ? page : page.data ?? [];
    return rows.map((r) => AttendanceMapper.toRecord(r, lookup));
  }

  /** Ekspor CSV laporan presensi (dibatasi server: rentang maks 92 hari). */
  static async exportCsv(from: string, to: string): Promise<void> {
    const res = await api.get('/attendance/reports/export', {
      params: { from, to },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `presensi-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Ekspor rekap presensi sebagai PDF (per siswa) — pelengkap CSV.
   * Server membatasi rentang maks 92 hari.
   */
  static async exportPdf(from: string, to: string): Promise<void> {
    const res = await api.get('/attendance/reports/pdf', {
      params: { from, to },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `presensi-${from}_${to}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Entri manual (fallback): wajib alasan; server menulis audit & menolak duplikat. */
  static async manual(
    nisn: string,
    date: string,
    status: 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alpa',
    reason: string,
    lookup?: Student[],
  ): Promise<AttendanceRecord> {
    const res = await api.post('/attendance/manual', { nisn, date, status, reason });
    return AttendanceMapper.toRecord(res.data.data as ServerAttendanceRow, lookup);
  }
}

export interface ParentChild {
  id: string;
  nisn: string;
  name: string;
  gender?: string | null;
  birth_date?: string | null;
  class_room?: { name: string; grade?: string; major?: string | null } | null;
  status?: string;
}

export class ParentService {
  static async children(): Promise<ParentChild[]> {
    const res = await api.get('/parent/children');
    return res.data.data.children as ParentChild[];
  }

  static async studentAttendance(studentId: string, lookup?: Student[]): Promise<AttendanceRecord[]> {
    const res = await api.get(`/parent/children/${studentId}/attendance`);
    const rows = res.data.data.records as ServerAttendanceRow[];
    return rows.map((r) => AttendanceMapper.toRecord(r, lookup));
  }

  static async studentInvoices(studentId: string): Promise<ServerSummary> {
    const res = await api.get(`/parent/children/${studentId}/invoices`);
    return res.data.data as ServerSummary;
  }

  static async studentGrades(studentId: string): Promise<ServerGrade[]> {
    const res = await api.get(`/parent/children/${studentId}/grades`);
    return res.data.data.grades as ServerGrade[];
  }

  /** Kartu KTS anak sebagai PDF (cookie sesi orang tua wajib; server men-otorisasi). */
  static async ktsCardBlob(studentId: string): Promise<Blob> {
    const res = await api.get(`/kts/students/${studentId}/card`, { responseType: 'blob' });
    return new Blob([res.data], { type: 'application/pdf' });
  }

  /** QR presensi anak sebagai SVG mentah (untuk pratinjau inline). */
  static async ktsQrSvg(studentId: string): Promise<string> {
    const res = await api.get(`/kts/students/${studentId}/qr.svg`, { responseType: 'text' });
    return String(res.data);
  }
}
