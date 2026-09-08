import React, { useState, useEffect } from 'react';
import { CbtExam, CbtQuestion } from '../../../types';
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
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';

interface CbtExamModuleProps {
  exams: CbtExam[];
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const CbtExamModule: React.FC<CbtExamModuleProps> = ({ exams, onShowToast }) => {
  const [selectedExam, setSelectedExam] = useState<CbtExam | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Student Answers: questionId -> 'A' | 'B' | 'C' | 'D' | 'E'
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Hesitant flags (Ragu-ragu): questionId -> boolean
  const [hesitant, setHesitant] = useState<Record<number, boolean>>({});

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

  // Start Exam
  const handleStartExam = (exam: CbtExam) => {
    setSelectedExam(exam);
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

  // Handle Option Select
  const handleSelectOption = (questionId: number, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  // Toggle Ragu-ragu
  const handleToggleHesitant = (questionId: number) => {
    setHesitant((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Finish and Grade Exam
  const calculateAndFinishExam = () => {
    if (!selectedExam) return;
    setIsTimerRunning(false);
    setConfirmModalOpen(false);

    let correctCount = 0;
    selectedExam.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount += 1;
      }
    });

    const total = selectedExam.questions.length;
    const score = Math.round((correctCount / total) * 100);
    const wrongCount = total - correctCount;

    setScoreResult({
      score,
      correct: correctCount,
      wrong: wrongCount,
      total,
    });
    setResultModalOpen(true);

    addAuditLog('CBT_EXAM_SUBMIT', `Ujian CBT selesai: ${selectedExam.title}. Skor: ${score} (${correctCount}/${total} benar)`, 'Siswa Ujian', 'siswa');
    onShowToast('Ujian Selesai', `Jawaban tersimpan. Nilai CBT Anda: ${score} / 100`, 'success');
  };

  // If in active exam room
  if (selectedExam) {
    const currentQ = selectedExam.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === selectedExam.questions.length - 1;
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
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/20 flex items-center gap-1.5"
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
                Soal Nomor {currentQuestionIndex + 1} dari {selectedExam.questions.length}
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
                          ? 'bg-teal-600 text-white'
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
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
                  data-testid="btn-confirm-finish-cbt"
                >
                  <Send className="w-4 h-4" />
                  <span>Selesai & Kumpulkan</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
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
                {answeredCount} / {selectedExam.questions.length} Terjawab
              </span>
            </div>

            {/* Grid numbers */}
            <div className="grid grid-cols-5 gap-2.5">
              {selectedExam.questions.map((q, idx) => {
                const isCurrent = currentQuestionIndex === idx;
                const isAnswered = !!answers[q.id];
                const isRagu = !!hesitant[q.id];

                let colorClasses = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';
                if (isRagu) {
                  colorClasses = 'bg-amber-100 border-amber-400 text-amber-900 font-bold';
                } else if (isAnswered) {
                  colorClasses = 'bg-emerald-600 border-emerald-600 text-white font-bold';
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
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 shrink-0" />
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
                <span className="font-bold">{selectedExam.questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Soal Terjawab:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-rose-800 font-semibold">
                <span>Belum Terjawab:</span>
                <span className="font-bold">{selectedExam.questions.length - answeredCount}</span>
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
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
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
                  <span className="text-slate-400 font-medium">Total Soal</span>
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
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
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

      {/* Exam cards list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exams.map((exam) => (
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
                  <span className="text-[10px] text-slate-400 font-semibold">Durasi</span>
                  <p className="font-bold text-slate-800">{exam.durationMinutes} Menit</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold">Jumlah Soal</span>
                  <p className="font-bold text-slate-800">{exam.questions.length} Butir (A-E)</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold">Tanggal</span>
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
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                data-testid={`btn-start-exam-${exam.id}`}
              >
                <span>Mulai Ujian</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
