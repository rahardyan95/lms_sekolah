import React, { useState, useEffect } from 'react';
import { CbtExam } from '../../../types';
import {
  CbtApiService,
  type CbtOptionKey,
  type CreateExamPayload,
  type ServerExamSummary,
} from '../../../services/CbtApiService';
import { TokenStorage } from '../../../services/TokenStorage';
import { AuthService } from '../../../services/AuthService';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  BookOpen,
  Award,
  HelpCircle,
  ShieldAlert,
  Plus,
  Trash2,
  Save,
  PenSquare,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';

interface CbtExamModuleProps {
  exams: CbtExam[];
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

/** Soal siap main — id dinormalisasi ke string agar mock (number) & server (ULID) seragam. */
interface RoomQuestion {
  id: string;
  question: string;
  options: Record<'A' | 'B' | 'C' | 'D' | 'E', string>;
}

function toRoomQuestions(exam: CbtExam): RoomQuestion[] {
  return exam.questions.map((q) => ({ id: String(q.id), question: q.question, options: q.options }));
}

/** Draft butir soal di builder guru — kunci jawaban hanya dikirim saat simpan. */
interface BuilderQuestion {
  question: string;
  options: Record<CbtOptionKey, string>;
  correctAnswer: CbtOptionKey;
  explanation: string;
}

const OPTION_KEYS: CbtOptionKey[] = ['A', 'B', 'C', 'D', 'E'];

function blankQuestion(): BuilderQuestion {
  return { question: '', options: { A: '', B: '', C: '', D: '', E: '' }, correctAnswer: 'A', explanation: '' };
}

function mapServerStatus(s: ServerExamSummary): CbtExam['status'] {
  if (s.is_open) return 'Sedang Berlangsung';
  if (s.status === 'published') return 'Akan Datang';
  return 'Selesai';
}

function toDisplayExam(s: ServerExamSummary): CbtExam {
  return {
    id: s.id,
    title: s.title,
    subjectName: s.subject_name,
    kelas: s.kelas,
    durationMinutes: s.duration_minutes,
    totalQuestions: s.total_questions,
    date: s.date,
    timeStart: s.time_start,
    timeEnd: s.time_end,
    status: mapServerStatus(s),
    questions: [],
  };
}

export const CbtExamModule: React.FC<CbtExamModuleProps> = ({ exams, onShowToast }) => {
  const [selectedExam, setSelectedExam] = useState<CbtExam | null>(null);
  const [roomQuestions, setRoomQuestions] = useState<RoomQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Student Answers: questionId -> 'A' | 'B' | 'C' | 'D' | 'E'
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Hesitant flags (Ragu-ragu): questionId -> boolean
  const [hesitant, setHesitant] = useState<Record<string, boolean>>({});

  // Mode server: aktif bila login + API menyediakan ujian (grading di server).
  const [serverExams, setServerExams] = useState<CbtExam[] | null>(null);
  const [serverAttemptId, setServerAttemptId] = useState<string | null>(null);
  // Naikkan untuk memuat ulang daftar ujian dari server (setelah simpan builder).
  const [refreshToken, setRefreshToken] = useState(0);

  // Tab default: daftar ujian (siswa). Builder hanya tampil untuk guru/admin.
  const [activeTab, setActiveTab] = useState<'list' | 'builder'>('list');
  const [isTeacher, setIsTeacher] = useState(false);

  // Form builder ujian guru.
  const [examTitle, setExamTitle] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examClass, setExamClass] = useState('');
  const [examDuration, setExamDuration] = useState('60');
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [examTimeStart, setExamTimeStart] = useState('07:00');
  const [examTimeEnd, setExamTimeEnd] = useState('09:00');
  const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');
  const [builderQuestions, setBuilderQuestions] = useState<BuilderQuestion[]>([blankQuestion()]);
  const [isSavingExam, setIsSavingExam] = useState(false);

  // Muat daftar ujian server (tanpa kunci) bila ada token; gagal → mock lokal (DEV).
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void CbtApiService.listExams()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setServerExams(list.map(toDisplayExam));
      })
      .catch(() => {
        /* API mati → fallback mock */
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Peran guru/admin dari server (bukan metadata UI): penentu akses tab builder.
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void AuthService.profile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setIsTeacher(['super_admin', 'admin_tu', 'guru'].includes(profile.role));
      })
      .catch(() => {
        /* gagal profil → builder tersembunyi (aman: server tetap menolak 403) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayExams = serverExams ?? exams;
  const isServerExam = (examId: string): boolean =>
    serverExams !== null && serverExams.some((e) => e.id === examId);

  // Countdown timer in seconds
  const [secondsRemaining, setSecondsRemaining] = useState(3600); // 60 mins default
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Submit confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Exam Result Modal
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [scoreResult, setScoreResult] = useState<{
    score: number;
    correct: number;
    wrong: number;
    total: number;
  } | null>(null);

  // Start Exam — server bila ujian berasal dari API (deadline jam server).
  const handleStartExam = async (exam: CbtExam) => {
    if (isServerExam(exam.id)) {
      try {
        const attempt = await CbtApiService.startAttempt(exam.id);
        setSelectedExam(exam);
        setRoomQuestions(
          attempt.questions.map((q) => ({ id: q.id, question: q.question, options: q.options }))
        );
        const savedAnswers: Record<string, string> = {};
        const savedHesitant: Record<string, boolean> = {};
        for (const q of attempt.questions) {
          if (q.answer) savedAnswers[q.id] = q.answer;
          if (q.hesitant) savedHesitant[q.id] = true;
        }
        setAnswers(savedAnswers);
        setHesitant(savedHesitant);
        setServerAttemptId(attempt.id);
        setCurrentQuestionIndex(0);
        setSecondsRemaining(attempt.seconds_remaining > 0 ? attempt.seconds_remaining : exam.durationMinutes * 60);
        setIsTimerRunning(true);
        addAuditLog('CBT_EXAM_START', `Siswa memulai ujian CBT (server): ${exam.title}`, 'Siswa Ujian', 'siswa');
        onShowToast('Ujian Dimulai', `Ruang ujian CBT aktif. Deadline dihitung jam server.`, 'info');
        return;
      } catch {
        onShowToast('Gagal Memulai', 'Jendela ujian tutup atau server tidak merespons.', 'error');
        return;
      }
    }

    setSelectedExam(exam);
    setRoomQuestions(toRoomQuestions(exam));
    setServerAttemptId(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setHesitant({});
    setSecondsRemaining(exam.durationMinutes * 60);
    setIsTimerRunning(true);
    addAuditLog('CBT_EXAM_START', `Siswa memulai ujian CBT: ${exam.title}`, 'Siswa Ujian', 'siswa');
    onShowToast('Ujian Dimulai', `Ruang ujian CBT aktif. Waktu pengerjaan: ${exam.durationMinutes} menit.`, 'info');
  };

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            // Auto submit
            setIsTimerRunning(false);
            calculateAndFinishExam();
            onShowToast('Waktu Habis', 'Waktu ujian telah berakhir. Jawaban otomatis dikumpulkan.', 'warning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  // Format seconds to mm:ss
  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle Option Select (autosave ke server pada mode server)
  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
    if (serverAttemptId) {
      const hesitantFlag = hesitant[questionId] ?? false;
      void CbtApiService.saveAnswer(
        serverAttemptId,
        questionId,
        option as 'A' | 'B' | 'C' | 'D' | 'E',
        hesitantFlag
      ).catch(() => {
        onShowToast('Autosave Gagal', 'Jawaban tersimpan lokal, coba lagi saat koneksi pulih.', 'warning');
      });
    }
  };

  // Toggle Ragu-ragu
  const handleToggleHesitant = (questionId: string) => {
    const next = !hesitant[questionId];
    setHesitant((prev) => ({
      ...prev,
      [questionId]: next,
    }));
    if (serverAttemptId) {
      const current = answers[questionId];
      if (current) {
        void CbtApiService.saveAnswer(
          serverAttemptId,
          questionId,
          current as 'A' | 'B' | 'C' | 'D' | 'E',
          next
        ).catch(() => {
          /* autosave ragu-ragu gagal: tidak fatal, tersimpan lokal */
        });
      }
    }
  };

  // Finish and Grade Exam — server bila mode server, lokal bila mock.
  const calculateAndFinishExam = async () => {
    if (!selectedExam) return;
    setIsTimerRunning(false);
    setConfirmModalOpen(false);

    if (serverAttemptId) {
      try {
        const result = await CbtApiService.submitAttempt(serverAttemptId);
        setScoreResult({
          score: result.score,
          correct: result.correct,
          wrong: result.wrong,
          total: result.total,
        });
        setResultModalOpen(true);
        addAuditLog('CBT_EXAM_SUBMIT', `Ujian CBT selesai (server): ${selectedExam.title}. Skor: ${result.score}`, 'Siswa Ujian', 'siswa');
        onShowToast('Ujian Selesai', `Nilai CBT Anda: ${result.score} / 100`, 'success');
        return;
      } catch {
        onShowToast('Gagal Mengumpulkan', 'Server tidak merespons. Coba lagi.', 'error');
        setIsTimerRunning(false);
        return;
      }
    }

    // Mode latihan lokal (tanpa kunci): tidak ada penilaian — kunci hanya di server.
    // Ujian sungguhan wajib lewat attempt server (deadline + grading idempotent).
    const answeredCount_local = Object.keys(answers).length;
    setScoreResult({
      score: 0,
      correct: 0,
      wrong: 0,
      total: roomQuestions.length,
    });
    setResultModalOpen(true);

    addAuditLog('CBT_EXAM_SUBMIT', `Latihan lokal selesai (tanpa nilai): ${selectedExam.title}. Terjawab ${answeredCount_local}/${roomQuestions.length}`, 'Siswa Ujian', 'siswa');
    onShowToast('Latihan Selesai', 'Mode latihan lokal tidak memberi nilai — mulai ujian via server untuk nilai resmi.', 'info');
  };

  // ── Builder ujian (guru/admin) ────────────────────────────────────────────
  const handleSaveExam = async () => {
    if (!TokenStorage.hasSession()) {
      onShowToast('Sesi Diperlukan', 'Masuk sebagai guru untuk membuat ujian.', 'error');
      return;
    }
    if (!examTitle.trim() || !examSubject.trim() || !examClass.trim()) {
      onShowToast('Data Belum Lengkap', 'Judul, mata pelajaran, dan kelas wajib diisi.', 'warning');
      return;
    }
    const duration = Number(examDuration);
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      onShowToast('Durasi Tidak Valid', 'Durasi harus berupa angka 1–480 menit.', 'warning');
      return;
    }
    if (!examDate || !examTimeStart || !examTimeEnd || examTimeEnd <= examTimeStart) {
      onShowToast('Jadwal Tidak Valid', 'Pastikan jam selesai lebih lambat dari jam mulai.', 'warning');
      return;
    }
    if (builderQuestions.length < 1 || builderQuestions.length > 100) {
      onShowToast('Jumlah Soal Tidak Valid', 'Ujian memuat 1–100 butir soal.', 'warning');
      return;
    }
    for (let i = 0; i < builderQuestions.length; i += 1) {
      const q = builderQuestions[i];
      const missing = OPTION_KEYS.find((k) => !q.options[k].trim());
      if (!q.question.trim() || missing) {
        onShowToast('Soal Belum Lengkap', `Soal #${i + 1}: teks soal dan semua opsi A–E wajib diisi.`, 'warning');
        return;
      }
    }

    const payload: CreateExamPayload = {
      title: examTitle.trim(),
      subject_name: examSubject.trim(),
      kelas: examClass.trim(),
      duration_minutes: duration,
      date: examDate,
      time_start: examTimeStart,
      time_end: examTimeEnd,
      status: examStatus,
      questions: builderQuestions.map((q) => ({
        question: q.question.trim(),
        options: OPTION_KEYS.reduce(
          (acc, k) => ({ ...acc, [k]: q.options[k].trim() }),
          { A: '', B: '', C: '', D: '', E: '' } as Record<CbtOptionKey, string>
        ),
        correct_answer: q.correctAnswer,
        ...(q.explanation.trim() ? { explanation: q.explanation.trim() } : {}),
      })),
    };

    setIsSavingExam(true);
    try {
      const created = await CbtApiService.createExam(payload);
      addAuditLog(
        'CBT_EXAM_CREATE',
        `Guru membuat ujian CBT: ${created.title} (${builderQuestions.length} soal)`,
        'Guru CBT',
        'guru'
      );
      onShowToast('Ujian Tersimpan', `"${created.title}" berhasil dibuat dengan ${builderQuestions.length} soal.`, 'success');
      setExamTitle('');
      setExamSubject('');
      setExamClass('');
      setExamDuration('60');
      setExamStatus('draft');
      setBuilderQuestions([blankQuestion()]);
      setActiveTab('list');
      setRefreshToken((t) => t + 1);
    } catch {
      onShowToast('Gagal Menyimpan', 'Server menolak ujian. Periksa kembali data dan izin akun.', 'error');
    } finally {
      setIsSavingExam(false);
    }
  };

  // If in active exam room
  if (selectedExam) {
    const currentQ = roomQuestions[currentQuestionIndex];
    if (!currentQ) {
      return (
        <div className="p-6 rounded-2xl border border-slate-200 bg-white text-xs text-slate-500" role="status">
          Memuat soal…
        </div>
      );
    }
    const isLastQuestion = currentQuestionIndex === roomQuestions.length - 1;
    const answeredCount = Object.keys(answers).length;
    const isTimeCritical = secondsRemaining < 300; // less than 5 mins

    return (
      <div className="space-y-6" data-testid="cbt-room">
        {/* CBT Top Bar with Live Countdown Timer */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-14 z-20">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold font-mono">
                CBT ONLINE SYSTEM
              </span>
              <span className="text-xs text-slate-500">{selectedExam.subjectName}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{selectedExam.title}</h3>
          </div>

          {/* Real-time Countdown Timer */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-black transition-colors ${
                isTimeCritical
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-teal-400'
              }`}
              data-testid="cbt-live-timer"
            >
              <Clock className="w-4 h-4" />
              <span>Sisa Waktu: {formatTimer(secondsRemaining)}</span>
            </div>

            <button
              onClick={() => setConfirmModalOpen(true)}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/20 flex items-center gap-1.5"
              data-testid="btn-submit-cbt-exam"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kumpulkan Ujian</span>
            </button>
          </div>
        </div>

        {/* Exam Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Question Sheet */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900 font-mono">
                Soal Nomor {currentQuestionIndex + 1} dari {roomQuestions.length}
              </span>
              <label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-800 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={!!hesitant[currentQ.id]}
                  onChange={() => handleToggleHesitant(currentQ.id)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  data-testid="checkbox-hesitant"
                />
                <span>Ragu-ragu</span>
              </label>
            </div>

            {/* Question Body */}
            <div className="text-sm text-slate-900 font-medium leading-relaxed">
              {currentQ.question}
            </div>

            {/* Multiple Choice Options (A, B, C, D, E) */}
            <div className="space-y-3 pt-2">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((optKey) => {
                const isSelected = answers[currentQ.id] === optKey;
                const optionText = currentQ.options[optKey];

                return (
                  <button
                    key={optKey}
                    onClick={() => handleSelectOption(currentQ.id, optKey)}
                    className={`w-full p-4 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 text-teal-950 font-semibold shadow-xs ring-1 ring-teal-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    data-testid={`option-${optKey}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 font-mono ${
                        isSelected
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {optKey}
                    </span>
                    <span className="leading-relaxed mt-0.5">{optionText}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl flex items-center gap-1.5 transition-colors"
                data-testid="btn-prev-question"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Soal Sebelumnya</span>
              </button>

              {isLastQuestion ? (
                <button
                  onClick={() => setConfirmModalOpen(true)}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs flex items-center gap-1.5"
                  data-testid="btn-confirm-finish-cbt"
                >
                  <Send className="w-4 h-4" />
                  <span>Selesai & Kumpulkan</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs flex items-center gap-1.5"
                  data-testid="btn-next-question"
                >
                  <span>Soal Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Question Status Grid (Nomor 1 - 30) */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Navigasi Soal
              </span>
              <span className="text-xs text-teal-700 font-mono font-bold">
                {answeredCount} / {roomQuestions.length} Terjawab
              </span>
            </div>

            {/* Grid numbers */}
            <div className="grid grid-cols-5 gap-2.5">
              {roomQuestions.map((q, idx) => {
                const isCurrent = currentQuestionIndex === idx;
                const isAnswered = !!answers[q.id];
                const isRagu = !!hesitant[q.id];

                let colorClasses = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';
                if (isRagu) {
                  colorClasses = 'bg-amber-100 border-amber-400 text-amber-900 font-bold';
                } else if (isAnswered) {
                  colorClasses = 'bg-emerald-700 border-emerald-600 text-white font-bold';
                }

                if (isCurrent) {
                  colorClasses += ' ring-2 ring-teal-500 ring-offset-2';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`aspect-square rounded-xl border text-xs font-mono transition-all flex flex-col items-center justify-center ${colorClasses}`}
                    data-testid={`grid-question-${idx + 1}`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && (
                      <span className="text-[9px] opacity-80">{answers[q.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status Legend */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-700 shrink-0" />
                <span>Sudah Terisi & Tersimpan Otomatis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400 shrink-0" />
                <span>Ragu-ragu (Perlu Diperiksa Kembali)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 shrink-0" />
                <span>Belum Dijawab</span>
              </div>
            </div>

            {/* Quick Submit button */}
            <button
              onClick={() => setConfirmModalOpen(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Konfirmasi Selesai Ujian
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Konfirmasi Pengumpulan Ujian CBT"
          subtitle="Pastikan seluruh jawaban telah Anda periksa sebelum mengakhiri sesi ujian."
          maxWidth="md"
          dataTestId="cbt-confirm-modal"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-700">
                <span>Total Soal:</span>
                <span className="font-bold">{roomQuestions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Soal Terjawab:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-rose-800 font-semibold">
                <span>Belum Terjawab:</span>
                <span className="font-bold">{roomQuestions.length - answeredCount}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Setelah dikumpulkan, sistem akan langsung mengkalkulasi skor nilai Anda secara otomatis (Auto-Grading). Anda tidak dapat mengubah jawaban setelahnya.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Kembali ke Soal
              </button>
              <button
                onClick={calculateAndFinishExam}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
                data-testid="btn-final-submit"
              >
                Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </Modal>

        {/* Auto-Grading Result Modal */}
        {scoreResult && (
          <Modal
            isOpen={resultModalOpen}
            onClose={() => {
              setResultModalOpen(false);
              setSelectedExam(null);
            }}
            title="Hasil Ujian CBT (Auto-Grading)"
            subtitle={`${selectedExam.title} — ${selectedExam.subjectName}`}
            maxWidth="md"
            dataTestId="cbt-result-modal"
          >
            <div className="space-y-6 text-center">
              {/* Score circle */}
              <div className="w-28 h-28 rounded-full bg-teal-50 border-4 border-teal-500 mx-auto flex flex-col items-center justify-center shadow-md">
                <span className="text-3xl font-black text-teal-800">{scoreResult.score}</span>
                <span className="text-[10px] text-teal-600 uppercase font-bold">Skor Akhir</span>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-medium">Total Soal</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{scoreResult.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Jawaban Benar</span>
                  <p className="text-base font-bold text-emerald-800 mt-0.5">{scoreResult.correct}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-rose-700 font-medium">Jawaban Salah</span>
                  <p className="text-base font-bold text-rose-800 mt-0.5">{scoreResult.wrong}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed text-left">
                Nilai telah disimpan ke dalam transkrip akademik dan database nilai guru pengampu secara instan.
              </div>

              <button
                onClick={() => {
                  setResultModalOpen(false);
                  setSelectedExam(null);
                }}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Kembali ke Daftar Ujian
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // DEFAULT VIEW: LIST OF AVAILABLE EXAMS
  return (
    <div className="space-y-6" data-testid="cbt-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <span>Ujian Online CBT (Computer Based Test)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Platform ujian daring dengan timer hitung mundur real-time, auto-save berkala, dan penilaian otomatis instan
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold font-mono">
          SERVER CBT: ONLINE (07:00 - 17:00 WIB)
        </span>
      </div>

      {/* Tab guru/admin: daftar ujian ↔ buat ujian baru */}
      {isTeacher && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeTab === 'list'
                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            data-testid="tab-cbt-list"
          >
            Daftar Ujian
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              activeTab === 'builder'
                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            data-testid="tab-cbt-builder"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Buat Ujian</span>
          </button>
        </div>
      )}

      {activeTab === 'builder' && isTeacher ? (
        <div className="space-y-6" data-testid="cbt-builder">
          {/* Meta ujian */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PenSquare className="w-4 h-4 text-teal-600" />
              <span>Informasi Ujian</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Judul Ujian *</span>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Contoh: Penilaian Tengah Semester Ganjil"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-title"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Mata Pelajaran *</span>
                <input
                  type="text"
                  value={examSubject}
                  onChange={(e) => setExamSubject(e.target.value)}
                  placeholder="Contoh: Matematika"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-subject"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Kelas *</span>
                <input
                  type="text"
                  value={examClass}
                  onChange={(e) => setExamClass(e.target.value)}
                  placeholder="Contoh: XII RPL 1"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-class"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Durasi (menit) *</span>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={examDuration}
                  onChange={(e) => setExamDuration(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-duration"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Tanggal *</span>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-date"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Jam Mulai *</span>
                  <input
                    type="time"
                    value={examTimeStart}
                    onChange={(e) => setExamTimeStart(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                    data-testid="input-exam-time-start"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Jam Selesai *</span>
                  <input
                    type="time"
                    value={examTimeEnd}
                    onChange={(e) => setExamTimeEnd(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                    data-testid="input-exam-time-end"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Status</span>
                <select
                  value={examStatus}
                  onChange={(e) => setExamStatus(e.target.value as 'draft' | 'published')}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  data-testid="input-exam-status"
                >
                  <option value="draft">Draft (belum tampil ke siswa)</option>
                  <option value="published">Terbitkan (tampil ke siswa)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Editor soal A–E */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Bank Soal ({builderQuestions.length} butir)
              </h3>
              <button
                onClick={() => setBuilderQuestions((prev) => [...prev, blankQuestion()])}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                data-testid="btn-add-question"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Soal</span>
              </button>
            </div>

            {builderQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 font-mono">Soal #{idx + 1}</span>
                  <button
                    onClick={() =>
                      setBuilderQuestions((prev) =>
                        prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                      )
                    }
                    disabled={builderQuestions.length <= 1}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-lg border border-rose-200 flex items-center gap-1 transition-colors"
                    data-testid={`btn-remove-question-${idx}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={q.question}
                  onChange={(e) =>
                    setBuilderQuestions((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, question: e.target.value } : item))
                    )
                  }
                  placeholder="Tuliskan pertanyaan..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 text-slate-800 leading-relaxed focus:ring-2 focus:ring-teal-500"
                  data-testid={`input-question-text-${idx}`}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {OPTION_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-bold font-mono text-slate-700 shrink-0">
                        {key}
                      </span>
                      <input
                        type="text"
                        value={q.options[key]}
                        onChange={(e) =>
                          setBuilderQuestions((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, options: { ...item.options, [key]: e.target.value } } : item
                            )
                          )
                        }
                        placeholder={`Opsi ${key}`}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                        data-testid={`input-option-${key.toLowerCase()}-${idx}`}
                      />
                    </label>
                  ))}

                  <label className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">Kunci</span>
                    <select
                      value={q.correctAnswer}
                      onChange={(e) =>
                        setBuilderQuestions((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, correctAnswer: e.target.value as CbtOptionKey } : item
                          )
                        )
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-bold focus:ring-2 focus:ring-teal-500"
                      data-testid={`input-correct-${idx}`}
                    >
                      {OPTION_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">Pembahasan</span>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        setBuilderQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, explanation: e.target.value } : item))
                        )
                      }
                      placeholder="Opsional"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500"
                      data-testid={`input-explanation-${idx}`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Aksi simpan */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveExam}
              disabled={isSavingExam}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              data-testid="btn-save-exam"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingExam ? 'Menyimpan…' : 'Simpan Ujian'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Exam cards list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayExams.map((exam) => (
          <div
            key={exam.id}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-teal-700 uppercase font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {exam.kelas}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {exam.status}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900">{exam.title}</h3>
              <p className="text-xs text-slate-500">{exam.subjectName}</p>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-semibold">Durasi</span>
                  <p className="font-bold text-slate-800">{exam.durationMinutes} Menit</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-semibold">Jumlah Soal</span>
                  <p className="font-bold text-slate-800">{exam.totalQuestions} Butir (A-E)</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-semibold">Tanggal</span>
                  <p className="font-bold text-slate-800">{exam.date}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                Waktu: {exam.timeStart} - {exam.timeEnd} WIB
              </span>
              <button
                onClick={() => handleStartExam(exam)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                data-testid={`btn-start-exam-${exam.id}`}
              >
                <span>Mulai Ujian</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
          </div>
        </>
      )}
    </div>
  );
};
