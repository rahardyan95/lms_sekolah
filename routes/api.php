<?php

use App\Http\Controllers\Api\V1\AcademicController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BroadcastController;
use App\Http\Controllers\Api\V1\CbtController;
use App\Http\Controllers\Api\V1\ContentController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\FinanceController;
use App\Http\Controllers\Api\V1\KtsController;
use App\Http\Controllers\Api\V1\LibraryController;
use App\Http\Controllers\Api\V1\LmsController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OtpController;
use App\Http\Controllers\Api\V1\ParentController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\SpmbController;
use App\Http\Controllers\Api\V1\StudentController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('/password/forgot', PasswordResetController::class)->middleware('throttle:auth');
    Route::post('/password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:auth');
    Route::post('/otp/request', [OtpController::class, 'request'])->middleware('throttle:auth');
    Route::post('/otp/verify', [OtpController::class, 'verify'])->middleware('throttle:auth');

    // SPMB publik: gelombang, daftar, cek status, unggah berkas (throttle ketat).
    Route::get('/spmb/waves', [SpmbController::class, 'waves']);
    Route::post('/spmb/waves/{wave}/applications', [SpmbController::class, 'submit'])->middleware('throttle:auth');
    Route::post('/spmb/status', [SpmbController::class, 'status'])->middleware('throttle:auth');
    Route::post('/spmb/applications/{application}/files', [SpmbController::class, 'upload'])->middleware('throttle:auth');
    Route::get('/spmb/applications/{application}/proof', [SpmbController::class, 'proof'])->middleware('throttle:auth');

    // CMS publik: hanya postingan published.
    Route::get('/cms/posts', [ContentController::class, 'index']);
    Route::get('/cms/posts/{slug}', [ContentController::class, 'show']);

    // KTS: verifikasi QR signed (throttle; tanpa data sensitif).
    Route::post('/kts/verify', [KtsController::class, 'verify'])->middleware('throttle:auth');

    Route::middleware(['auth:sanctum', 'sentry.context', 'throttle:api'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);

        // Ringkasan dashboard staf (angka nyata dari DB, bukan mock klien).
        Route::get('/dashboard/summary', [DashboardController::class, 'summary'])
            ->middleware('role:super_admin,admin_tu,guru,bendahara,operator');
        Route::get('/students', [StudentController::class, 'index']);
        Route::post('/students', [StudentController::class, 'store']);
        Route::get('/students/{student}', [StudentController::class, 'show']);
        Route::put('/students/{student}', [StudentController::class, 'update']);
        Route::delete('/students/{student}', [StudentController::class, 'destroy']);
        Route::post('/attendance/scans', [AttendanceController::class, 'scan']);
        Route::post('/attendance/manual', [AttendanceController::class, 'manual']);
        Route::get('/attendance/reports', [AttendanceController::class, 'reports']);
        Route::get('/attendance/reports/export', [AttendanceController::class, 'export']);

        // Portal orang tua — scope: hanya anak pada pivot guardian_student.
        Route::get('/parent/children', [ParentController::class, 'children']);
        Route::get('/parent/children/{student}/attendance', [ParentController::class, 'studentAttendance']);
        Route::get('/parent/children/{student}/invoices', [ParentController::class, 'studentInvoices']);
        Route::get('/parent/children/{student}/grades', [ParentController::class, 'studentGrades']);

        // CBT server-side: soal publik tanpa kunci; grading di server.
        Route::get('/cbt/exams', [CbtController::class, 'index']);
        Route::post('/cbt/exams', [CbtController::class, 'store']);
        Route::patch('/cbt/exams/{exam}/status', [CbtController::class, 'updateStatus']);
        Route::post('/cbt/exams/{exam}/attempts', [CbtController::class, 'start']);
        Route::get('/cbt/attempts/{attempt}', [CbtController::class, 'show']);
        Route::patch('/cbt/attempts/{attempt}/answers', [CbtController::class, 'answer']);
        Route::post('/cbt/attempts/{attempt}/submit', [CbtController::class, 'submit']);

        // Finance: pos bayar, distribusi idempotent, pembayaran + kwitansi unik.
        Route::get('/finance/items', [FinanceController::class, 'items']);
        Route::post('/finance/items', [FinanceController::class, 'storeItem']);
        Route::post('/finance/items/{item}/distribute', [FinanceController::class, 'distribute']);
        Route::get('/finance/invoices', [FinanceController::class, 'invoices']);
        Route::post('/finance/invoices/{invoice}/payments', [FinanceController::class, 'pay']);
        Route::get('/finance/payments/{payment}/receipt', [FinanceController::class, 'receipt']);
        Route::get('/finance/payments/{payment}/receipt.pdf', [FinanceController::class, 'receiptPdf']);
        Route::post('/finance/invoices/{invoice}/adjust', [FinanceController::class, 'adjust']);
        Route::get('/finance/bank-accounts', [FinanceController::class, 'bankAccounts']);
        Route::post('/finance/bank-accounts', [FinanceController::class, 'storeBankAccount']);
        Route::get('/finance/cash', [FinanceController::class, 'cash']);
        Route::post('/finance/cash', [FinanceController::class, 'storeCash']);
        Route::get('/finance/reports/cash', [FinanceController::class, 'cashReport']);
        Route::get('/finance/students/{student}/summary', [FinanceController::class, 'summary']);

        // SPMB panitia: review, verifikasi, keputusan, konversi, unduh berkas.
        Route::get('/spmb/applications', [SpmbController::class, 'review']);
        Route::post('/spmb/applications/{application}/verify', [SpmbController::class, 'verify']);
        Route::post('/spmb/applications/{application}/decide', [SpmbController::class, 'decide']);
        Route::post('/spmb/applications/{application}/convert', [SpmbController::class, 'convert']);
        Route::get('/spmb/files/{file}/download', [SpmbController::class, 'download']);

        // LMS: mapel, materi privat, tugas + pengumpulan berdeadline, nilai.
        Route::get('/lms/subjects', [LmsController::class, 'subjects']);
        Route::post('/lms/subjects', [LmsController::class, 'storeSubject']);
        Route::get('/lms/materials', [LmsController::class, 'materials']);
        Route::post('/lms/materials', [LmsController::class, 'storeMaterial']);
        Route::get('/lms/materials/{material}/download', [LmsController::class, 'downloadMaterial'])
            ->name('lms.materials.download')
            ->middleware('signed');
        Route::get('/lms/assignments', [LmsController::class, 'assignments']);
        Route::post('/lms/assignments', [LmsController::class, 'storeAssignment']);
        Route::post('/lms/assignments/{assignment}/submissions', [LmsController::class, 'submit']);
        Route::get('/lms/assignments/{assignment}/submissions', [LmsController::class, 'submissions']);
        Route::patch('/lms/submissions/{submission}/grade', [LmsController::class, 'gradeSubmission']);
        Route::get('/lms/grades/mine', [LmsController::class, 'myGrades']);
        Route::get('/lms/summary/mine', [LmsController::class, 'mySummary']);
        Route::post('/lms/subjects/{subject}/grades/bulk', [LmsController::class, 'bulkGrades']);

        // Perpustakaan: katalog, pinjam/kembali, e-book.
        Route::get('/library/books', [LibraryController::class, 'index']);
        Route::post('/library/books', [LibraryController::class, 'store']);
        Route::post('/library/books/{book}/borrow', [LibraryController::class, 'borrow']);
        Route::post('/library/loans/{loan}/return', [LibraryController::class, 'giveBack']);
        Route::get('/library/loans', [LibraryController::class, 'loans']);
        Route::get('/library/books/{book}/ebook', [LibraryController::class, 'ebook'])
            ->name('library.ebook')
            ->middleware('signed');

        // Akademik: jadwal (anti-bentrok), pengumuman teraudience.
        Route::get('/academic/schedules', [AcademicController::class, 'schedules']);
        Route::post('/academic/schedules', [AcademicController::class, 'storeSchedule']);
        Route::put('/academic/schedules/{schedule}', [AcademicController::class, 'updateSchedule']);
        Route::delete('/academic/schedules/{schedule}', [AcademicController::class, 'destroySchedule']);
        Route::get('/academic/announcements', [AcademicController::class, 'announcements']);
        Route::post('/academic/announcements', [AcademicController::class, 'storeAnnouncement']);
        Route::get('/academic/years', [AcademicController::class, 'academicYears']);
        Route::post('/academic/years', [AcademicController::class, 'storeYear']);
        Route::put('/academic/years/{year}', [AcademicController::class, 'updateYear']);
        Route::post('/academic/years/{year}/activate', [AcademicController::class, 'activateYear']);
        Route::delete('/academic/years/{year}', [AcademicController::class, 'destroyYear']);
        Route::get('/academic/classes', [AcademicController::class, 'classRooms']);

        // CMS kelola (draft/publish).
        Route::get('/cms/admin/posts', [ContentController::class, 'manage']);
        Route::post('/cms/posts', [ContentController::class, 'store']);
        Route::put('/cms/posts/{post}', [ContentController::class, 'update']);
        Route::delete('/cms/posts/{post}', [ContentController::class, 'destroy']);

        // KTS: terbitkan & cabut token QR (petugas).
        Route::post('/kts/students/{student}/issue', [KtsController::class, 'issue']);
        Route::post('/kts/tokens/{token}/revoke', [KtsController::class, 'revoke']);

        // KTS: template berversi + kartu PDF + QR SVG (scoped per policy).
        Route::get('/kts/templates/active', [KtsController::class, 'template']);
        Route::put('/kts/templates', [KtsController::class, 'saveTemplate']);
        Route::get('/kts/students/{student}/card', [KtsController::class, 'card']);
        Route::get('/kts/students/{student}/tokens', [KtsController::class, 'tokens']);
        Route::get('/kts/students/{student}/qr.svg', [KtsController::class, 'qr'])->name('kts.qr');

        // Broadcast WA + log pengiriman.
        Route::get('/broadcasts', [BroadcastController::class, 'index']);
        Route::post('/broadcasts', [BroadcastController::class, 'store']);
        Route::get('/broadcasts/{broadcast}/logs', [BroadcastController::class, 'logs']);
        Route::post('/whatsapp/test', [BroadcastController::class, 'testMessage']);

        // Pengaturan sistem (baca; tulis super-admin).
        Route::get('/settings', [SettingsController::class, 'index']);
        Route::put('/settings/{key}', [SettingsController::class, 'update']);

        // Log notifikasi terkirim (WA/SMTP) + kirim ulang manual.
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{log}/retry', [NotificationController::class, 'retry']);
    });
});
