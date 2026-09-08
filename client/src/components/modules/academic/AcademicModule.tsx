import React, { useState } from 'react';
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
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';

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
  const [activeTab, setActiveTab] = useState<'bulk_grading' | 'jadwal' | 'master_akademik' | 'pengumuman'>('bulk_grading');

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

  // Save Bulk Grading
  const handleSaveBulkGrades = () => {
    const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
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
    addAuditLog('BULK_GRADING_SAVED', `Entri nilai massal disimpan untuk kelas ${selectedClass} (${currentSubject?.name})`, 'Guru Pengampu', 'guru');
    onShowToast('Nilai Massal Tersimpan', `Berhasil memperbarui nilai rapor seluruh siswa kelas ${selectedClass}.`, 'success');
  };

  // Submit New Announcement
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ancTitle || !ancContent) return;

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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
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
                  {subjects.map((sub) => (
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
              onClick={handleSaveBulkGrades}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              data-testid="btn-save-bulk-grades"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Semua Nilai Rapor</span>
            </button>
          </div>

          {/* Bulk Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
            <span className="text-xs font-mono font-bold text-teal-700">Semester Ganjil 2026/2027</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.map((sch) => (
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
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              data-testid="btn-add-announcement"
            >
              <Plus className="w-4 h-4" />
              <span>Publikasikan Pengumuman</span>
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map((anc) => (
              <div
                key={anc.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">{anc.date}</span>
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

      {/* NEW ANNOUNCEMENT MODAL */}
      <Modal
        isOpen={isNewAncModalOpen}
        onClose={() => setIsNewAncModalOpen(false)}
        title="Publikasikan Pengumuman Sekolah"
        subtitle="Siarkan pengumuman resmi ke portal Siswa, Guru, atau Orang Tua"
        maxWidth="md"
        dataTestId="new-announcement-modal"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
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
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              Publikasikan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
