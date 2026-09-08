export type UserRole =
  | 'super_admin'
  | 'admin_tu'
  | 'guru'
  | 'bendahara'
  | 'operator'
  | 'siswa'
  | 'orang_tua'
  | 'calon_siswa'
  | 'public';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  nisn?: string;
  nip?: string;
  avatar: string;
  kelas?: string;
  jurusan?: string;
  phone?: string;
}

export interface Student {
  id: string;
  nisn: string;
  nik: string;
  name: string;
  gender: 'L' | 'P';
  kelas: string;
  jurusan: string;
  angkatan: string;
  parentName: string;
  parentPhone: string;
  photo: string;
  birthDate: string;
  birthPlace: string;
  address: string;
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  title: string;
  mapel: string[];
  phone: string;
  email: string;
  photo: string;
}

export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Sakit' | 'Izin' | 'Alpa';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  nisn: string;
  studentName: string;
  kelas: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  status: AttendanceStatus;
  notes?: string;
  minutesLate?: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: 'Wajib' | 'Peminatan' | 'Kejuruan';
  kkm: number;
  teacherId: string;
  teacherName: string;
}

export interface ScheduleItem {
  id: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';
  timeStart: string;
  timeEnd: string;
  kelas: string;
  subjectName: string;
  teacherName: string;
  room: string;
}

export interface Assignment {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  deadline: string;
  teacherName: string;
  kelas: string;
  status: 'Belum Dikerjakan' | 'Sudah Dikumpulkan' | 'Dinilai';
  submittedFile?: string;
  submittedAt?: string;
  score?: number;
  feedback?: string;
}

export interface LearningMaterial {
  id: string;
  subjectName: string;
  title: string;
  description: string;
  fileType: 'PDF' | 'PPT' | 'DOC' | 'VIDEO';
  fileSize: string;
  downloadUrl: string;
  uploadedAt: string;
  author: string;
  kelas: string;
}

export interface CbtQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
}

export interface CbtExam {
  id: string;
  title: string;
  subjectName: string;
  kelas: string;
  durationMinutes: number;
  totalQuestions: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: 'Akan Datang' | 'Sedang Berlangsung' | 'Selesai';
  questions: CbtQuestion[];
}

export interface StudentGrade {
  id: string;
  studentId: string;
  nisn: string;
  studentName: string;
  kelas: string;
  subjectId: string;
  subjectName: string;
  nilaiTugas: number;
  nilaiUTS: number;
  nilaiUAS: number;
  nilaiAkhir: number;
  predikat: 'A' | 'B' | 'C' | 'D';
  catatanGuru: string;
}

export type SppMonthStatus = 'Lunas' | 'Cicilan' | 'Belum Lunas';

export interface SppMonthlyRecord {
  month: string; // 'Juli', 'Agustus', dst.
  fee: number;
  paidAmount: number;
  status: SppMonthStatus;
  paidDate?: string;
  receiptNumber?: string;
}

export interface StudentSppProfile {
  studentId: string;
  nisn: string;
  studentName: string;
  kelas: string;
  months: SppMonthlyRecord[];
  totalTagihan: number;
  totalDibayar: number;
  sisaTagihan: number;
}

export interface CashTransaction {
  id: string;
  date: string;
  type: 'Pemasukan' | 'Pengeluaran';
  category: string;
  description: string;
  amount: number;
  proofNumber: string;
  pic: string;
}

export interface SpmbCandidate {
  id: string;
  registrationNumber: string;
  waveId: string;
  name: string;
  nisn: string;
  nik: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  previousSchool: string;
  averageReportScore: number;
  chosenMajor: string;
  status: 'Draft' | 'Verified' | 'Accepted' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  registeredAt: string;
}

export interface SpmbWave {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  quota: number;
  filled: number;
  fee: number;
  isActive: boolean;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  year: number;
  category: string;
  physicalStock: number;
  availableStock: number;
  hasEbook: boolean;
  pageCount: number;
  coverImage: string;
  summary: string;
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  excerpt: string;
  content: string;
  image: string;
  tags: string[];
}

export interface Announcement {
  id: string;
  title: string;
  targetRole: 'Semua' | 'Siswa' | 'Guru' | 'Orang Tua';
  date: string;
  content: string;
  isImportant: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface SchoolConfig {
  name: string;
  npsn: string;
  akreditasi: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  headmaster: string;
  headmasterNip: string;
  academicYear: string;
  activeSemester: 'Ganjil' | 'Genap';
  waGatewayProvider: 'Fonnte' | 'Wablas' | 'Custom API';
  waApiKey: string;
  waSenderNumber: string;
  waActive: boolean;
  spmbActive: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
}
