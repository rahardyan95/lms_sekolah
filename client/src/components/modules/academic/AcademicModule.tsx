import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Student,
  Subject,
  ScheduleItem,
  StudentGrade,
  Announcement,
  SchoolConfig,
} from '../../../types';
import {
  GraduationCap,
  Calendar,
  Award,
  Bell,
  Plus,
  Save,
  Clock,
  CheckCircle2,
  Users,
  Search,
  BookOpen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';
import { AcademicApiService, type ServerAcademicYear } from '../../../services/AcademicApiService';
import {
  LmsApiService,
  type ServerAssignment,
  type ServerSubmission,
  type ServerMaterial,
} from '../../../services/LmsApiService';
import { AuthService } from '../../../services/AuthService';
import { StudentService } from '../../../services/DomainService';
import { TokenStorage } from '../../../services/TokenStorage';

/** Hari KBM sesuai kosakata server (`Schedule::DAYS`). */
const SCHEDULE_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

const MATERIAL_TYPES: ServerMaterial['file_type'][] = ['PDF', 'PPT', 'DOC', 'VIDEO'];

/** Ambil pesan error dari envelope server (`{errors:{message}}` / `{message}`). */
function serverMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback;
  const payload: unknown = err.response?.data;
  if (payload !== null && typeof payload === 'object') {
    if ('errors' in payload) {
      const errors = payload.errors;
      if (errors !== null && typeof errors === 'object' && 'message' in errors
        && typeof errors.message === 'string' && errors.message.length > 0) {
        return errors.message;
      }
    }
    if ('message' in payload && typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  }
  return fallback;
}

interface AcademicModuleProps {
  students: Student[];
  subjects: Subject[];
  schedule: ScheduleItem[];
  grades: StudentGrade[];
  announcements: Announcement[];
  schoolConfig: SchoolConfig;
  onUpdateGrades: (updatedGrades: StudentGrade[]) => void;
  onAddAnnouncement: (announcement: Announcement) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const AcademicModule: React.FC<AcademicModuleProps> = ({
  students,
  subjects,
  schedule,
  grades: initialGrades,
  announcements,
  schoolConfig,
  onUpdateGrades,
  onAddAnnouncement,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'bulk_grading' | 'jadwal' | 'master_akademik' | 'pengumuman' | 'academic_years' | 'lms_manage'
  >('bulk_grading');

  // Bulk Grading State
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || 'SBJ-001');
  const [selectedClass, setSelectedClass] = useState('X RPL 1');
  const [gradeMatrix, setGradeMatrix] = useState<Record<string, { tugas: number; uts: number; uas: number; catatan: string }>>(() => {
    const initial: Record<string, { tugas: number; uts: number; uas: number; catatan: string }> = {};
    students.forEach((s) => {
      const g = initialGrades.find((item) => item.studentId === s.id && item.subjectId === selectedSubjectId);
      initial[s.id] = {
        tugas: g ? g.nilaiTugas : 85,
        uts: g ? g.nilaiUTS : 80,
        uas: g ? g.nilaiUAS : 85,
        catatan: g ? g.catatanGuru : 'Partisipatif dan tekun.',
      };
    });
    return initial;
  });

  // New Announcement Modal
  const [isNewAncModalOpen, setIsNewAncModalOpen] = useState(false);
  const [ancTitle, setAncTitle] = useState('');
  const [ancRole, setAncRole] = useState<'Semua' | 'Siswa' | 'Guru' | 'Orang Tua'>('Semua');
  const [ancContent, setAncContent] = useState('');
  const [ancImportant, setAncImportant] = useState(false);

  // Jadwal CRUD (server-first: mutasi hanya saat sesi aktif)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [schDay, setSchDay] = useState<string>('Senin');
  const [schStart, setSchStart] = useState('07:30');
  const [schEnd, setSchEnd] = useState('09:30');
  const [schClass, setSchClass] = useState('');
  const [schSubject, setSchSubject] = useState('');
  const [schTeacher, setSchTeacher] = useState('');
  const [schRoom, setSchRoom] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deletingScheduleBusy, setDeletingScheduleBusy] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleItem>>({});
  const [hiddenScheduleIds, setHiddenScheduleIds] = useState<string[]>([]);
  const [extraSchedules, setExtraSchedules] = useState<ScheduleItem[]>([]);

  // Tahun akademik
  const [serverYears, setServerYears] = useState<ServerAcademicYear[] | null>(null);
  const [yearLabel, setYearLabel] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [savingYear, setSavingYear] = useState(false);
  const [busyYearId, setBusyYearId] = useState<string | null>(null);

  // Kelola LMS (guru/admin)
  const [isStaff, setIsStaff] = useState(false);
  const [classRooms, setClassRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [subjCode, setSubjCode] = useState('');
  const [subjName, setSubjName] = useState('');
  const [subjKkm, setSubjKkm] = useState('75');
  const [savingSubject, setSavingSubject] = useState(false);
  const [matTitle, setMatTitle] = useState('');
  const [matType, setMatType] = useState<ServerMaterial['file_type']>('PDF');
  const [matClass, setMatClass] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [asgTitle, setAsgTitle] = useState('');
  const [asgDeadline, setAsgDeadline] = useState('');
  const [asgClass, setAsgClass] = useState('');
  const [asgSubjectId, setAsgSubjectId] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [lmsAssignments, setLmsAssignments] = useState<ServerAssignment[] | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [lmsSubmissions, setLmsSubmissions] = useState<ServerSubmission[] | null>(null);
  const [gradeDraft, setGradeDraft] = useState<Record<string, { score: string; feedback: string }>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  // Server-first: mapel, jadwal, pengumuman + peta NISN→id server.
  const [serverSubjects, setServerSubjects] = useState<Subject[] | null>(null);
  const [serverSchedules, setServerSchedules] = useState<ScheduleItem[] | null>(null);
  const [serverAnnouncements, setServerAnnouncements] = useState<Announcement[] | null>(null);
  const [serverStudentIds, setServerStudentIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const [subs, schs, ancs, stus] = await Promise.all([
          AcademicApiService.subjects(),
          AcademicApiService.schedules(),
          AcademicApiService.announcements(),
          StudentService.list(''),
        ]);
        if (cancelled) return;
        if (subs.length > 0) {
          setServerSubjects(
            subs.map((s) => ({
              id: s.id, code: s.code, name: s.name,
              category: (s.category === 'Wajib' || s.category === 'Peminatan' || s.category === 'Kejuruan' ? s.category : 'Wajib') as Subject['category'],
              kkm: s.kkm, teacherId: '', teacherName: '',
            }))
          );
          setSelectedSubjectId((prev) =>
            subs.some((s) => s.id === prev) ? prev : subs[0].id
          );
        }
        if (schs.length > 0) {
          setServerSchedules(
            schs.map((s) => ({
              id: s.id, day: s.day as ScheduleItem['day'],
              timeStart: s.time_start, timeEnd: s.time_end, kelas: s.kelas,
              subjectName: s.subject_name, teacherName: s.teacher_name, room: s.room ?? '',
            }))
          );
        }
        setServerAnnouncements(
          ancs.map((a) => ({
            id: a.id, title: a.title,
            targetRole: (['Semua', 'Siswa', 'Guru', 'Orang Tua'] as const).includes(a.target_role as Announcement['targetRole'])
              ? (a.target_role as Announcement['targetRole'])
              : 'Semua',
            date: String(a.created_at).slice(0, 10),
            content: a.content,
            isImportant: a.is_important,
          }))
        );
        const map: Record<string, string> = {};
        for (const st of stus) {
          const nisn = (st as unknown as { nisn?: string }).nisn;
          if (nisn) map[nisn] = String(st.id);
        }
        setServerStudentIds(map);
      } catch {
        /* offline → mock */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Identitas staf (guru/admin) + daftar kelas server untuk form jadwal/LMS.
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void AuthService.profile()
      .then((profile) => {
        if (cancelled || !profile) return;
        const staff = ['super_admin', 'admin_tu', 'guru'].includes(profile.role);
        setIsStaff(staff);
        if (!staff) return;
        void AcademicApiService.classes()
          .then((rows) => {
            if (!cancelled) setClassRooms(rows.map((c) => ({ id: c.id, name: c.name })));
          })
          .catch(() => {
            /* daftar kelas gagal → pakai kelas lokal dari data siswa */
          });
      })
      .catch(() => {
        /* profil gagal → tab kelola disembunyikan; server tetap menolak 403 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tahun akademik dimuat saat tab dibuka (hemat request; server mengotorisasi).
  useEffect(() => {
    if (activeTab !== 'academic_years' || !TokenStorage.hasSession()) {
      if (activeTab !== 'academic_years') setServerYears(null);
      return;
    }
    let cancelled = false;
    void AcademicApiService.years()
      .then((rows) => {
        if (!cancelled) setServerYears(rows);
      })
      .catch(() => {
        if (!cancelled) setServerYears(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Daftar tugas guru dimuat saat tab Kelola LMS dibuka.
  useEffect(() => {
    if (activeTab !== 'lms_manage' || !TokenStorage.hasSession()) return;
    let cancelled = false;
    void LmsApiService.assignments()
      .then((rows) => {
        if (!cancelled) setLmsAssignments(rows);
      })
      .catch(() => {
        if (!cancelled) setLmsAssignments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Pengumpulan tugas terpilih → tabel penilaian.
  useEffect(() => {
    if (!selectedAssignmentId || !TokenStorage.hasSession()) {
      setLmsSubmissions(null);
      return;
    }
    let cancelled = false;
    void LmsApiService.submissions(selectedAssignmentId)
      .then((rows) => {
        if (cancelled) return;
        setLmsSubmissions(rows);
        setGradeDraft({});
      })
      .catch(() => {
        if (!cancelled) setLmsSubmissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAssignmentId]);

  const displaySubjects = serverSubjects ?? subjects;
  const displaySchedules = [...(serverSchedules ?? []), ...schedule, ...extraSchedules]
    .filter((sch) => !hiddenScheduleIds.includes(sch.id))
    .map((sch) => scheduleOverrides[sch.id] ?? sch);
  const classOptions = classRooms.length > 0
    ? classRooms.map((c) => c.name)
    : students.map((s) => s.kelas).filter((k, i, arr) => arr.indexOf(k) === i).sort();
  const displayAnnouncements = [...(serverAnnouncements ?? []), ...announcements];

  // Handle grade change in bulk matrix
  const handleGradeChange = (
    studentId: string,
    field: 'tugas' | 'uts' | 'uas' | 'catatan',
    value: string
  ) => {
    setGradeMatrix((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: field === 'catatan' ? value : parseInt(value, 10) || 0,
      },
    }));
  };

  // Save Bulk Grading — server-first bila mapel & siswa terpetakan ke server.
  const handleSaveBulkGrades = async () => {
    const currentSubject = displaySubjects.find((s) => s.id === selectedSubjectId);
    const updatedGradesList: StudentGrade[] = students.map((s) => {
      const entry = gradeMatrix[s.id] || { tugas: 80, uts: 80, uas: 80, catatan: '' };
      const akhir = Math.round(entry.tugas * 0.3 + entry.uts * 0.3 + entry.uas * 0.4);
      const predikat = akhir >= 88 ? 'A' : akhir >= 78 ? 'B' : akhir >= 68 ? 'C' : 'D';

      return {
        id: `GRD-${s.id}-${selectedSubjectId}`,
        studentId: s.id,
        nisn: s.nisn,
        studentName: s.name,
        kelas: s.kelas,
        subjectId: selectedSubjectId,
        subjectName: currentSubject ? currentSubject.name : 'Mata Pelajaran',
        nilaiTugas: entry.tugas,
        nilaiUTS: entry.uts,
        nilaiUAS: entry.uas,
        nilaiAkhir: akhir,
        predikat,
        catatanGuru: entry.catatan,
      };
    });

    onUpdateGrades(updatedGradesList);
    if (serverSubjects !== null && TokenStorage.hasSession()) {
      const rows = students
        .filter((s) => serverStudentIds[s.nisn])
        .map((s) => {
          const entry = gradeMatrix[s.id] || { tugas: 80, uts: 80, uas: 80, catatan: '' };
          return {
            student_id: serverStudentIds[s.nisn],
            nilai_tugas: entry.tugas,
            nilai_uts: entry.uts,
            nilai_uas: entry.uas,
            catatan_guru: entry.catatan,
          };
        });
      if (rows.length > 0) {
        try {
          const report = await AcademicApiService.bulkGrades(selectedSubjectId, rows, true);
          addAuditLog('BULK_GRADING_SERVER', `Nilai massal server: ${report.created} baru, ${report.updated} diperbarui`, 'Guru Pengampu', 'guru');
        } catch {
          onShowToast('Sinkron Server Gagal', 'Nilai tersimpan lokal; server menolak.', 'warning');
        }
      }
    }
    addAuditLog('BULK_GRADING_SAVED', `Entri nilai massal disimpan untuk kelas ${selectedClass} (${currentSubject?.name})`, 'Guru Pengampu', 'guru');
    onShowToast('Nilai Massal Tersimpan', `Berhasil memperbarui nilai rapor seluruh siswa kelas ${selectedClass}.`, 'success');
  };

  // Submit New Announcement — server-first bila login.
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ancTitle || !ancContent) return;

    if (TokenStorage.hasSession()) {
      try {
        const saved = await AcademicApiService.createAnnouncement({
          title: ancTitle,
          content: ancContent,
          target_role: ancRole,
          is_important: ancImportant,
          published: true,
        });
        const row: Announcement = {
          id: saved.id,
          title: saved.title,
          targetRole: ancRole,
          date: new Date().toISOString().slice(0, 10),
          content: saved.content,
          isImportant: saved.is_important,
        };
        setServerAnnouncements((prev) => [row, ...(prev ?? [])]);
        addAuditLog('ANNOUNCEMENT_CREATE', `Pengumuman server diterbitkan: ${ancTitle}`, 'Admin Akademik', 'admin_tu');
        onShowToast('Pengumuman Diterbitkan', 'Tersimpan di server & disiarkan ke portal.', 'success');
        setIsNewAncModalOpen(false);
        setAncTitle('');
        setAncContent('');
        setAncImportant(false);
        return;
      } catch {
        /* lanjut fallback lokal */
      }
    }

    const newAnc: Announcement = {
      id: `ANC-${Date.now()}`,
      title: ancTitle,
      targetRole: ancRole,
      date: '2026-09-08',
      content: ancContent,
      isImportant: ancImportant,
    };

    onAddAnnouncement(newAnc);
    addAuditLog('ANNOUNCEMENT_CREATE', `Pengumuman diterbitkan: ${ancTitle} (Target: ${ancRole})`, 'Admin Akademik', 'admin_tu');
    onShowToast('Pengumuman Diterbitkan', `Pengumuman baru telah disiarkan ke portal ${ancRole}.`, 'success');
    setIsNewAncModalOpen(false);
    setAncTitle('');
    setAncContent('');
    setAncImportant(false);
  };

  // --- Jadwal: modal tambah/edit ---
  const openCreateSchedule = () => {
    setEditingScheduleId(null);
    setSchDay('Senin');
    setSchStart('07:30');
    setSchEnd('09:30');
    setSchClass(classOptions[0] ?? '');
    setSchSubject(displaySubjects[0]?.name ?? '');
    setSchTeacher('');
    setSchRoom('');
    setIsScheduleModalOpen(true);
  };

  const openEditSchedule = (sch: ScheduleItem) => {
    setEditingScheduleId(sch.id);
    setSchDay(sch.day);
    setSchStart(sch.timeStart.slice(0, 5));
    setSchEnd(sch.timeEnd.slice(0, 5));
    setSchClass(sch.kelas);
    setSchSubject(sch.subjectName);
    setSchTeacher(sch.teacherName);
    setSchRoom(sch.room);
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Jadwal tersimpan di server — login sebagai staf untuk mengubahnya.', 'warning');
      return;
    }
    if (!schClass.trim() || !schSubject.trim() || !schTeacher.trim() || !schStart || !schEnd) {
      onShowToast('Input Kurang', 'Hari, jam, kelas, mapel, dan guru wajib diisi.', 'error');
      return;
    }
    const payload = {
      day: schDay,
      time_start: schStart,
      time_end: schEnd,
      kelas: schClass.trim(),
      subject_name: schSubject.trim(),
      teacher_name: schTeacher.trim(),
      room: schRoom.trim() || undefined,
    };
    setSavingSchedule(true);
    try {
      if (editingScheduleId !== null) {
        const saved = await AcademicApiService.updateSchedule(editingScheduleId, payload);
        const mapped: ScheduleItem = {
          id: saved.id,
          day: SCHEDULE_DAYS.find((d): d is ScheduleItem['day'] => d === saved.day) ?? 'Senin',
          timeStart: saved.time_start.slice(0, 5),
          timeEnd: saved.time_end.slice(0, 5),
          kelas: saved.kelas,
          subjectName: saved.subject_name,
          teacherName: saved.teacher_name,
          room: saved.room ?? '',
        };
        setScheduleOverrides((prev) => ({ ...prev, [saved.id]: mapped }));
        addAuditLog('SCHEDULE_UPDATE', `Jadwal ${mapped.day} ${mapped.timeStart} kelas ${mapped.kelas} diperbarui`, 'Admin Akademik', 'admin_tu');
        onShowToast('Jadwal Diperbarui', 'Perubahan jadwal tersimpan di server.', 'success');
      } else {
        const saved = await AcademicApiService.createSchedule(payload);
        const mapped: ScheduleItem = {
          id: saved.id,
          day: SCHEDULE_DAYS.find((d): d is ScheduleItem['day'] => d === saved.day) ?? 'Senin',
          timeStart: saved.time_start.slice(0, 5),
          timeEnd: saved.time_end.slice(0, 5),
          kelas: saved.kelas,
          subjectName: saved.subject_name,
          teacherName: saved.teacher_name,
          room: saved.room ?? '',
        };
        if (serverSchedules !== null) setServerSchedules((prev) => [...(prev ?? []), mapped]);
        else setExtraSchedules((prev) => [...prev, mapped]);
        addAuditLog('SCHEDULE_CREATE', `Jadwal ${mapped.day} ${mapped.timeStart} kelas ${mapped.kelas} dibuat`, 'Admin Akademik', 'admin_tu');
        onShowToast('Jadwal Ditambahkan', 'Jadwal baru tersimpan di server.', 'success');
      }
      setIsScheduleModalOpen(false);
    } catch (err) {
      // 409 anti-bentrok wajib terlihat: tampilkan pesan server apa adanya.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      onShowToast(
        status === 409 ? 'Jadwal Bentrok' : 'Gagal Menyimpan Jadwal',
        serverMessage(err, 'Server menolak jadwal. Periksa jam dan kelas.'),
        status === 409 ? 'warning' : 'error',
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (deleteScheduleId === null) return;
    const id = deleteScheduleId;
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Penghapusan jadwal butuh koneksi server.', 'warning');
      return;
    }
    setDeletingScheduleBusy(true);
    try {
      await AcademicApiService.deleteSchedule(id);
      setHiddenScheduleIds((prev) => [...prev, id]);
      addAuditLog('SCHEDULE_DELETE', `Jadwal ${id} dihapus`, 'Admin Akademik', 'admin_tu');
      onShowToast('Jadwal Dihapus', 'Jadwal telah dihapus dari server.', 'success');
      setDeleteScheduleId(null);
    } catch (err) {
      onShowToast('Gagal Menghapus', serverMessage(err, 'Server menolak penghapusan jadwal.'), 'error');
    } finally {
      setDeletingScheduleBusy(false);
    }
  };

  // --- Tahun akademik ---
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Tahun akademik tersimpan di server — login untuk menambah.', 'warning');
      return;
    }
    if (!yearLabel.trim() || !yearStart || !yearEnd) {
      onShowToast('Input Kurang', 'Label, tanggal mulai, dan tanggal selesai wajib diisi.', 'error');
      return;
    }
    setSavingYear(true);
    try {
      const saved = await AcademicApiService.createYear({
        label: yearLabel.trim(),
        starts_at: yearStart,
        ends_at: yearEnd,
      });
      setServerYears((prev) => [...(prev ?? []), saved]);
      setYearLabel('');
      setYearStart('');
      setYearEnd('');
      addAuditLog('ACADEMIC_YEAR_CREATE', `Tahun akademik ${saved.label} dibuat`, 'Admin Akademik', 'admin_tu');
      onShowToast('Tahun Akademik Dibuat', `${saved.label} tersimpan di server.`, 'success');
    } catch (err) {
      onShowToast('Gagal Menyimpan', serverMessage(err, 'Server menolak tahun akademik baru.'), 'error');
    } finally {
      setSavingYear(false);
    }
  };

  const handleActivateYear = async (id: string) => {
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Aktivasi tahun akademik butuh koneksi server.', 'warning');
      return;
    }
    setBusyYearId(id);
    try {
      await AcademicApiService.activateYear(id);
      setServerYears((prev) => (prev ?? []).map((y) => ({ ...y, active: y.id === id })));
      addAuditLog('ACADEMIC_YEAR_ACTIVATE', `Tahun akademik ${id} diaktifkan`, 'Admin Akademik', 'admin_tu');
      onShowToast('Tahun Aktif Diperbarui', 'Tepat satu tahun akademik aktif di server.', 'success');
    } catch (err) {
      onShowToast('Gagal Mengaktifkan', serverMessage(err, 'Server menolak aktivasi tahun akademik.'), 'error');
    } finally {
      setBusyYearId(null);
    }
  };

  const handleDeleteYear = async (id: string) => {
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Penghapusan tahun akademik butuh koneksi server.', 'warning');
      return;
    }
    setBusyYearId(id);
    try {
      await AcademicApiService.deleteYear(id);
      setServerYears((prev) => (prev ?? []).filter((y) => y.id !== id));
      onShowToast('Tahun Akademik Dihapus', 'Riwayat tahun tanpa siswa telah dihapus.', 'success');
    } catch (err) {
      // 409 YEAR_IN_USE: riwayat tidak boleh dihapus — jelaskan ke pengguna.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      onShowToast(
        status === 409 ? 'Tahun Masih Dipakai' : 'Gagal Menghapus',
        serverMessage(err, 'Server menolak penghapusan tahun akademik.'),
        status === 409 ? 'warning' : 'error',
      );
    } finally {
      setBusyYearId(null);
    }
  };

  // --- Kelola LMS (guru/admin) ---
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Mapel tersimpan di server — login sebagai guru.', 'warning');
      return;
    }
    if (!subjCode.trim() || !subjName.trim()) {
      onShowToast('Input Kurang', 'Kode dan nama mata pelajaran wajib diisi.', 'error');
      return;
    }
    setSavingSubject(true);
    try {
      await LmsApiService.storeSubject({
        code: subjCode.trim(),
        name: subjName.trim(),
        kkm: parseInt(subjKkm, 10) || undefined,
      });
      setSubjCode('');
      setSubjName('');
      onShowToast('Mata Pelajaran Disimpan', 'Mapel baru tersimpan di server.', 'success');
    } catch (err) {
      onShowToast('Gagal Menyimpan', serverMessage(err, 'Server menolak mata pelajaran baru.'), 'error');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Materi tersimpan di server — login sebagai guru.', 'warning');
      return;
    }
    if (!matTitle.trim()) {
      onShowToast('Input Kurang', 'Judul materi wajib diisi.', 'error');
      return;
    }
    setSavingMaterial(true);
    try {
      await LmsApiService.storeMaterial({
        title: matTitle.trim(),
        file_type: matType,
        kelas: matClass || undefined,
        file: matFile,
      });
      setMatTitle('');
      setMatFile(null);
      onShowToast('Materi Diunggah', 'Materi baru tersimpan di server.', 'success');
    } catch (err) {
      onShowToast('Gagal Mengunggah', serverMessage(err, 'Server menolak materi baru.'), 'error');
    } finally {
      setSavingMaterial(false);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Tugas tersimpan di server — login sebagai guru.', 'warning');
      return;
    }
    if (!asgTitle.trim() || !asgDeadline || !asgSubjectId) {
      onShowToast('Input Kurang', 'Judul, tenggat, dan mata pelajaran wajib diisi.', 'error');
      return;
    }
    setSavingAssignment(true);
    try {
      const saved = await LmsApiService.storeAssignment({
        subject_id: asgSubjectId,
        title: asgTitle.trim(),
        deadline: asgDeadline,
        kelas: asgClass || undefined,
      });
      setLmsAssignments((prev) => [...(prev ?? []), saved]);
      setSelectedAssignmentId(saved.id);
      setAsgTitle('');
      setAsgDeadline('');
      onShowToast('Tugas Dibuat', 'Tugas baru tersimpan di server.', 'success');
    } catch (err) {
      onShowToast('Gagal Membuat Tugas', serverMessage(err, 'Server menolak tugas baru.'), 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Penilaian tersimpan di server.', 'warning');
      return;
    }
    const draft = gradeDraft[submissionId] ?? { score: '', feedback: '' };
    const score = draft.score.trim() === '' ? null : parseInt(draft.score, 10);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
      onShowToast('Nilai Tidak Valid', 'Nilai harus bilangan 0–100.', 'error');
      return;
    }
    setGradingId(submissionId);
    try {
      const saved = await LmsApiService.gradeSubmission(submissionId, score, draft.feedback.trim() || undefined);
      setLmsSubmissions((prev) => (prev ?? []).map((s) => (s.id === saved.id ? saved : s)));
      addAuditLog('SUBMISSION_GRADE', `Nilai tugas dikirim untuk submission ${submissionId}`, 'Guru Pengampu', 'guru');
      onShowToast('Nilai Tersimpan', 'Nilai & umpan balik tersimpan di server.', 'success');
    } catch (err) {
      onShowToast('Gagal Menilai', serverMessage(err, 'Server menolak penilaian.'), 'error');
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="academic-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-600" />
            <span>Manajemen Akademik, Jadwal & Penilaian Massal</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan tahun ajaran aktif, struktur kurikulum, jadwal pelajaran mingguan, dan entri nilai massal
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('bulk_grading')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'bulk_grading'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-bulk-grading"
          >
            Entri Nilai Massal
          </button>
          <button
            onClick={() => setActiveTab('jadwal')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'jadwal'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-academic-schedule"
          >
            Jadwal Pelajaran KBM
          </button>
          <button
            onClick={() => setActiveTab('master_akademik')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'master_akademik'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-academic-master"
          >
            Kelas & Jurusan
          </button>
          <button
            onClick={() => setActiveTab('pengumuman')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'pengumuman'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-academic-announcements"
          >
            Pengumuman
          </button>
          <button
            onClick={() => setActiveTab('academic_years')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'academic_years'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-academic-years"
          >
            Tahun Akademik
          </button>
          {isStaff && (
            <button
              onClick={() => setActiveTab('lms_manage')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'lms_manage'
                  ? 'bg-white text-teal-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="tab-academic-lms"
            >
              Kelola LMS
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: BULK GRADING MATRIX */}
      {activeTab === 'bulk_grading' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pilih Mata Pelajaran</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                  data-testid="select-grading-subject"
                >
                  {displaySubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} — {sub.name} (KKM: {sub.kkm})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kelas Target</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                  data-testid="select-grading-class"
                >
                  <option value="X RPL 1">X RPL 1</option>
                  <option value="XI TKJ 1">XI TKJ 1</option>
                  <option value="XII DKV 1">XII DKV 1</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => void handleSaveBulkGrades()}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              data-testid="btn-save-bulk-grades"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Semua Nilai Rapor</span>
            </button>
          </div>

          {/* Bulk Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">NISN</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5 text-center w-24">Tugas (30%)</th>
                  <th className="p-3.5 text-center w-24">UTS (30%)</th>
                  <th className="p-3.5 text-center w-24">UAS (40%)</th>
                  <th className="p-3.5 text-center w-24">Nilai Akhir</th>
                  <th className="p-3.5 text-center w-16">Predikat</th>
                  <th className="p-3.5 min-w-[200px]">Catatan Evaluasi Guru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const entry = gradeMatrix[student.id] || { tugas: 80, uts: 80, uas: 80, catatan: '' };
                  const akhir = Math.round(entry.tugas * 0.3 + entry.uts * 0.3 + entry.uas * 0.4);
                  const predikat = akhir >= 88 ? 'A' : akhir >= 78 ? 'B' : akhir >= 68 ? 'C' : 'D';

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80">
                      <td className="p-3.5 font-mono text-slate-500">{student.nisn}</td>
                      <td className="p-3.5 font-bold text-slate-900">{student.name}</td>
                      <td className="p-3.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={entry.tugas}
                          onChange={(e) => handleGradeChange(student.id, 'tugas', e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={entry.uts}
                          onChange={(e) => handleGradeChange(student.id, 'uts', e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={entry.uas}
                          onChange={(e) => handleGradeChange(student.id, 'uas', e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                        />
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-sm text-teal-800 bg-teal-50/50">
                        {akhir}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold inline-flex items-center justify-center font-mono text-xs">
                          {predikat}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <input
                          type="text"
                          value={entry.catatan}
                          onChange={(e) => handleGradeChange(student.id, 'catatan', e.target.value)}
                          placeholder="Catatan perkembangan belajar..."
                          className="w-full p-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: JADWAL PELAJARAN */}
      {activeTab === 'jadwal' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Jadwal Kegiatan Belajar Mengajar (KBM) Mingguan
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-700">Semester Ganjil 2026/2027</span>
              <button
                onClick={openCreateSchedule}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                data-testid="btn-add-schedule"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Jadwal</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displaySchedules.map((sch) => (
              <div
                key={sch.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 hover:border-teal-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-mono font-bold">
                    {sch.day}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {sch.timeStart} - {sch.timeEnd}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{sch.subjectName}</h4>
                <p className="text-[11px] text-slate-600">{sch.teacherName}</p>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
                  <span>Kelas: <strong>{sch.kelas}</strong></span>
                  <span>Ruangan: <strong>{sch.room}</strong></span>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => openEditSchedule(sch)}
                    className="px-2 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg flex items-center gap-1"
                    data-testid={`btn-edit-schedule-${sch.id.slice(0, 8)}`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Ubah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteScheduleId(sch.id)}
                    className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1"
                    data-testid={`btn-delete-schedule-${sch.id.slice(0, 8)}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: MASTER KELAS & JURUSAN */}
      {activeTab === 'master_akademik' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Program Keahlian & Rombongan Belajar (Rombel)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold font-mono">
                RPL
              </span>
              <h4 className="text-sm font-bold text-slate-900">Rekayasa Perangkat Lunak</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fokus pengembangan aplikasi web modern, sistem terdistribusi, mobile application, dan basis data PostgreSQL.
              </p>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200 font-mono">
                <p>• Kelas X RPL 1 (36 Siswa)</p>
                <p>• Kelas XI RPL 1 (35 Siswa)</p>
                <p>• Kelas XII RPL 1 (36 Siswa)</p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold font-mono">
                TKJ
              </span>
              <h4 className="text-sm font-bold text-slate-900">Teknik Komputer & Jaringan</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Infrastruktur jaringan komputer, routing enterprise Mikrotik/Cisco, server administration Linux, dan keamanan siber.
              </p>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200 font-mono">
                <p>• Kelas X TKJ 1 (36 Siswa)</p>
                <p>• Kelas XI TKJ 1 (36 Siswa)</p>
                <p>• Kelas XII TKJ 1 (34 Siswa)</p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold font-mono">
                DKV
              </span>
              <h4 className="text-sm font-bold text-slate-900">Desain Komunikasi Visual</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Desain publikasi kreatif, UI/UX design, animasi 2D/3D, branding identity, dan videografi produksi multimedia.
              </p>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200 font-mono">
                <p>• Kelas X DKV 1 (36 Siswa)</p>
                <p>• Kelas XI DKV 1 (35 Siswa)</p>
                <p>• Kelas XII DKV 1 (36 Siswa)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: PENGUMUMAN SEKOLAH */}
      {activeTab === 'pengumuman' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Daftar Pengumuman Internal Sekolah
            </h3>
            <button
              onClick={() => setIsNewAncModalOpen(true)}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              data-testid="btn-add-announcement"
            >
              <Plus className="w-4 h-4" />
              <span>Publikasikan Pengumuman</span>
            </button>
          </div>

          <div className="space-y-3">
            {displayAnnouncements.map((anc) => (
              <div
                key={anc.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">{anc.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      Target: {anc.targetRole}
                    </span>
                    {anc.isImportant && <Badge variant="warning" size="sm">Penting</Badge>}
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{anc.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{anc.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: TAHUN AKADEMIK */}
      {activeTab === 'academic_years' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Tahun Akademik — aktivasi eksklusif (tepat satu aktif)
            </h3>
          </div>

          <form
            onSubmit={(e) => void handleCreateYear(e)}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200"
          >
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Label Tahun</label>
              <input
                type="text"
                value={yearLabel}
                onChange={(e) => setYearLabel(e.target.value)}
                placeholder="2026/2027"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-year-label"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mulai</label>
              <input
                type="date"
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-year-start"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Selesai</label>
              <input
                type="date"
                value={yearEnd}
                onChange={(e) => setYearEnd(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-year-end"
              />
            </div>
            <button
              type="submit"
              disabled={savingYear}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              data-testid="btn-create-year"
            >
              <Plus className="w-4 h-4" />
              <span>{savingYear ? 'Menyimpan…' : 'Tambah Tahun'}</span>
            </button>
          </form>

          {!TokenStorage.hasSession() && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3" role="status">
              Login sebagai staf akademik untuk memuat dan mengelola tahun akademik server.
            </p>
          )}

          <div className="space-y-3">
            {(serverYears ?? []).map((year) => (
              <div
                key={year.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{year.label}</h4>
                    {year.active && <Badge variant="success" size="sm">Aktif</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    {String(year.starts_at).slice(0, 10)} → {String(year.ends_at).slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleActivateYear(year.id)}
                    disabled={year.active || busyYearId === year.id}
                    className="px-3 py-1.5 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 border border-teal-200 rounded-lg flex items-center gap-1.5"
                    data-testid={`btn-activate-year-${year.id.slice(0, 8)}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{year.active ? 'Sedang Aktif' : 'Aktifkan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteYear(year.id)}
                    disabled={busyYearId === year.id}
                    className="px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 border border-rose-200 rounded-lg flex items-center gap-1.5"
                    data-testid={`btn-delete-year-${year.id.slice(0, 8)}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
            {TokenStorage.hasSession() && serverYears !== null && serverYears.length === 0 && (
              <p className="text-xs text-slate-500 italic">Belum ada tahun akademik di server.</p>
            )}
          </div>
        </div>
      )}

      {/* VIEW 6: KELOLA LMS (GURU) */}
      {activeTab === 'lms_manage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Form mapel */}
            <form
              onSubmit={(e) => void handleSaveSubject(e)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Mata Pelajaran Baru</h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kode</label>
                <input
                  type="text"
                  value={subjCode}
                  onChange={(e) => setSubjCode(e.target.value)}
                  placeholder="MTK-01"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-subject-code"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Mapel</label>
                <input
                  type="text"
                  value={subjName}
                  onChange={(e) => setSubjName(e.target.value)}
                  placeholder="Matematika"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-subject-name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">KKM</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={subjKkm}
                  onChange={(e) => setSubjKkm(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={savingSubject}
                className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs"
                data-testid="btn-save-subject"
              >
                {savingSubject ? 'Menyimpan…' : 'Simpan Mapel'}
              </button>
            </form>

            {/* Form materi */}
            <form
              onSubmit={(e) => void handleSaveMaterial(e)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Unggah Materi</h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Judul Materi</label>
                <input
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="Modul Trigonometri"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-material-title"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Jenis Berkas</label>
                <select
                  value={matType}
                  onChange={(e) => {
                    const next = MATERIAL_TYPES.find((type) => type === e.target.value);
                    if (next) setMatType(next);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  data-testid="input-material-type"
                >
                  {MATERIAL_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kelas</label>
                <select
                  value={matClass}
                  onChange={(e) => setMatClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  data-testid="input-material-class"
                >
                  <option value="">Semua kelas</option>
                  {classOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Berkas (opsional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4"
                  onChange={(e) => setMatFile(e.target.files?.[0] ?? null)}
                  className="w-full text-[11px] text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-semibold"
                  data-testid="input-material-file"
                />
              </div>
              <button
                type="submit"
                disabled={savingMaterial}
                className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs"
                data-testid="btn-save-material"
              >
                {savingMaterial ? 'Mengunggah…' : 'Simpan Materi'}
              </button>
            </form>

            {/* Form tugas */}
            <form
              onSubmit={(e) => void handleSaveAssignment(e)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Buat Tugas</h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Judul Tugas</label>
                <input
                  type="text"
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="Latihan Bab 3"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-assignment-title"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tenggat</label>
                <input
                  type="datetime-local"
                  value={asgDeadline}
                  onChange={(e) => setAsgDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-mono"
                  data-testid="input-assignment-deadline"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kelas</label>
                <select
                  value={asgClass}
                  onChange={(e) => setAsgClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  data-testid="input-assignment-class"
                >
                  <option value="">Semua kelas</option>
                  {classOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mata Pelajaran</label>
                <select
                  value={asgSubjectId}
                  onChange={(e) => setAsgSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  data-testid="input-assignment-subject"
                >
                  <option value="">Pilih mapel…</option>
                  {displaySubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.code} — {sub.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={savingAssignment}
                className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs"
                data-testid="btn-save-assignment"
              >
                {savingAssignment ? 'Menyimpan…' : 'Simpan Tugas'}
              </button>
            </form>
          </div>

          {/* Tabel pengumpulan */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pengumpulan & Penilaian Tugas
              </h3>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                data-testid="select-lms-assignment"
              >
                <option value="">Pilih tugas…</option>
                {(lmsAssignments ?? []).map((asg) => (
                  <option key={asg.id} value={asg.id}>{asg.title}</option>
                ))}
              </select>
            </div>

            {lmsSubmissions === null ? (
              <p className="text-xs text-slate-500 italic">
                Pilih tugas untuk memuat daftar pengumpulan siswa.
              </p>
            ) : lmsSubmissions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Belum ada pengumpulan untuk tugas ini.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">NISN</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Berkas</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center w-24">Nilai</th>
                      <th className="p-3 min-w-[200px]">Umpan Balik</th>
                      <th className="p-3 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lmsSubmissions.map((sub) => {
                      const draft = gradeDraft[sub.id] ?? {
                        score: sub.score !== null ? String(sub.score) : '',
                        feedback: sub.feedback ?? '',
                      };
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono text-slate-500">{sub.student?.nisn ?? '—'}</td>
                          <td className="p-3 font-bold text-slate-900">{sub.student?.name ?? sub.original_name ?? '—'}</td>
                          <td className="p-3 text-slate-600">{sub.original_name ?? '—'}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={draft.score}
                              onChange={(e) => setGradeDraft((prev) => ({
                                ...prev,
                                [sub.id]: { score: e.target.value, feedback: prev[sub.id]?.feedback ?? sub.feedback ?? '' },
                              }))}
                              className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={draft.feedback}
                              onChange={(e) => setGradeDraft((prev) => ({
                                ...prev,
                                [sub.id]: { score: prev[sub.id]?.score ?? (sub.score !== null ? String(sub.score) : ''), feedback: e.target.value },
                              }))}
                              placeholder="Catatan untuk siswa…"
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => void handleGrade(sub.id)}
                              disabled={gradingId === sub.id}
                              className="px-3 py-1.5 text-[11px] font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg"
                              data-testid={`btn-grade-${sub.id.slice(0, 8)}`}
                            >
                              {gradingId === sub.id ? 'Menyimpan…' : 'Nilai'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW ANNOUNCEMENT MODAL */}
      <Modal
        isOpen={isNewAncModalOpen}
        onClose={() => setIsNewAncModalOpen(false)}
        title="Publikasikan Pengumuman Sekolah"
        subtitle="Siarkan pengumuman resmi ke portal Siswa, Guru, atau Orang Tua"
        maxWidth="md"
        dataTestId="new-announcement-modal"
      >
        <form onSubmit={(e) => void handleCreateAnnouncement(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul Pengumuman</label>
            <input
              type="text"
              value={ancTitle}
              onChange={(e) => setAncTitle(e.target.value)}
              required
              placeholder="Contoh: Jadwal Libur Awal Semester Ganjil"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Audiens</label>
            <select
              value={ancRole}
              onChange={(e) => setAncRole(e.target.value as any)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
            >
              <option value="Semua">Semua Pengguna</option>
              <option value="Siswa">Siswa Saja</option>
              <option value="Guru">Dewan Guru</option>
              <option value="Orang Tua">Orang Tua / Wali</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Isi Pengumuman</label>
            <textarea
              value={ancContent}
              onChange={(e) => setAncContent(e.target.value)}
              required
              rows={4}
              placeholder="Tuliskan detail pengumuman resmi sekolah..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 text-slate-800 leading-relaxed"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={ancImportant}
              onChange={(e) => setAncImportant(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs font-semibold text-amber-800">Tandai sebagai Pengumuman Penting</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewAncModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              Publikasikan
            </button>
          </div>
        </form>
      </Modal>

      {/* SCHEDULE MODAL (tambah/edit) */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title={editingScheduleId !== null ? 'Ubah Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
        subtitle="Bentrok jam per kelas divalidasi server — 409 tampil sebagai peringatan"
        maxWidth="lg"
        dataTestId="modal-schedule"
      >
        <form onSubmit={(e) => void handleSaveSchedule(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hari</label>
              <select
                value={schDay}
                onChange={(e) => setSchDay(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                data-testid="input-schedule-day"
              >
                {SCHEDULE_DAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kelas</label>
              <select
                value={schClass}
                onChange={(e) => setSchClass(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                data-testid="input-schedule-class"
              >
                <option value="">Pilih kelas…</option>
                {classOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jam Mulai</label>
              <input
                type="time"
                value={schStart}
                onChange={(e) => setSchStart(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-mono"
                data-testid="input-schedule-start"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jam Selesai</label>
              <input
                type="time"
                value={schEnd}
                onChange={(e) => setSchEnd(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-mono"
                data-testid="input-schedule-end"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mata Pelajaran</label>
              <input
                type="text"
                list="schedule-subject-options"
                value={schSubject}
                onChange={(e) => setSchSubject(e.target.value)}
                placeholder="Matematika"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-schedule-subject"
              />
              <datalist id="schedule-subject-options">
                {displaySubjects.map((sub) => (
                  <option key={sub.id} value={sub.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Guru Pengampu</label>
              <input
                type="text"
                value={schTeacher}
                onChange={(e) => setSchTeacher(e.target.value)}
                placeholder="Nama guru"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-schedule-teacher"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ruangan</label>
              <input
                type="text"
                value={schRoom}
                onChange={(e) => setSchRoom(e.target.value)}
                placeholder="R-101"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                data-testid="input-schedule-room"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingSchedule}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-xl shadow-xs"
              data-testid="btn-save-schedule"
            >
              {savingSchedule ? 'Menyimpan…' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE SCHEDULE */}
      <Modal
        isOpen={deleteScheduleId !== null}
        onClose={() => setDeleteScheduleId(null)}
        title="Hapus Jadwal Pelajaran"
        subtitle="Penghapusan permanen di server"
        maxWidth="sm"
        dataTestId="modal-confirm-delete-schedule"
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Jadwal terpilih akan dihapus dari server. Lanjutkan?
        </p>
        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setDeleteScheduleId(null)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSchedule()}
            disabled={deletingScheduleBusy}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl shadow-xs"
            data-testid="btn-confirm-delete-schedule"
          >
            {deletingScheduleBusy ? 'Menghapus…' : 'Hapus Jadwal'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
