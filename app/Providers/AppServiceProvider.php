<?php

namespace App\Providers;

use App\Contracts\WhatsappGatewayInterface;
use App\Events\AttendanceRecorded;
use App\Listeners\QueueAttendanceNotification;
use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\Assignment;
use App\Models\Book;
use App\Models\Broadcast;
use App\Models\CbtAttempt;
use App\Models\CbtExam;
use App\Models\Grade;
use App\Models\Invoice;
use App\Models\KtsToken;
use App\Models\Material;
use App\Models\NotificationLog;
use App\Models\Post;
use App\Models\Schedule;
use App\Models\SchoolSetting;
use App\Models\SpmbApplication;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use App\Observers\BookObserver;
use App\Policies\CbtPolicy;
use App\Policies\FinancePolicy;
use App\Policies\LmsPolicy;
use App\Policies\OpsPolicy;
use App\Policies\SpmbPolicy;
use App\Services\SettingsService;
use App\Services\WhatsappService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(WhatsappGatewayInterface::class, WhatsappService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(AttendanceRecorded::class, QueueAttendanceNotification::class);

        // Satu policy CBT melayani Exam + Attempt (nama tak ikut konvensi tebakan).
        Gate::policy(CbtExam::class, CbtPolicy::class);
        Gate::policy(CbtAttempt::class, CbtPolicy::class);
        Gate::policy(Invoice::class, FinancePolicy::class);
        Gate::define('viewStudentInvoices', [FinancePolicy::class, 'viewStudentInvoices']);
        Gate::define('viewInvoice', [FinancePolicy::class, 'viewInvoice']);
        Gate::define('viewKtsCard', [OpsPolicy::class, 'viewKtsCard']);
        Gate::policy(SpmbApplication::class, SpmbPolicy::class);
        Gate::policy(Subject::class, LmsPolicy::class);
        Gate::policy(Material::class, LmsPolicy::class);
        Gate::policy(Assignment::class, LmsPolicy::class);
        Gate::policy(Submission::class, LmsPolicy::class);
        Gate::policy(Grade::class, LmsPolicy::class);
        Gate::policy(Book::class, OpsPolicy::class);
        Gate::policy(Schedule::class, OpsPolicy::class);
        Gate::policy(AcademicYear::class, OpsPolicy::class);
        Gate::policy(Announcement::class, OpsPolicy::class);
        Gate::policy(Post::class, OpsPolicy::class);
        Gate::policy(KtsToken::class, OpsPolicy::class);
        Gate::policy(Broadcast::class, OpsPolicy::class);
        Gate::policy(SchoolSetting::class, OpsPolicy::class);
        Gate::policy(NotificationLog::class, OpsPolicy::class);

        // Data master (mapel, kelas, tahun akademik) hanya untuk komunitas sekolah
        // aktif — peran portal murni (calon_siswa) tidak perlu enumerasi ini.
        Gate::define('viewMasterData', fn (User $user) => $user->hasAnyRole([
            'super_admin', 'admin_tu', 'guru', 'bendahara', 'operator', 'siswa',
        ]));

        // Panel Pengaturan menyimpan SMTP di school_settings; terapkan ke
        // konfigurasi mail saat boot (env tetap fallback) agar isian panel
        // benar-benar berlaku. Perubahan panel aktif setelah worker reload
        // (`octane:reload` / restart container), karena config di-cache per proses.
        $this->applyMailSettings();

        // Indeks pencarian buku disinkronkan lewat observer (kegagalan Meili ditelan).
        Book::observe(BookObserver::class);

        // App API-only: link reset password mengarah ke SPA frontend,
        // bukan route web Laravel (yang tidak ada).
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim((string) config('app.frontend_url', config('app.url')), '/')
            .'/reset-password?token='.$token.'&email='.urlencode((string) $user->getEmailForPasswordReset()));

        // Auth sensitif: ketat di produksi; longgar di local/testing agar
        // pengembangan & E2E tidak flaky karena 429 (bukan kontrol produksi).
        RateLimiter::for('auth', function (Request $request) {
            $max = app()->environment('production') ? 10 : 1000;

            return Limit::perMinutes(15, $max)->by($request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            $max = app()->runningUnitTests() ? 1000 : 300;

            return Limit::perMinute($max)->by($request->user()?->id ?: $request->ip());
        });
    }

    /**
     * SMTP dari panel Pengaturan → konfigurasi mail runtime. Dibungkus try/catch
     * agar boot tetap jalan saat migrasi belum dijalankan / DB belum siap.
     */
    private function applyMailSettings(): void
    {
        try {
            if (! Schema::hasTable('school_settings')) {
                return;
            }

            $settings = $this->app->make(SettingsService::class)->all(true);
        } catch (\Throwable) {
            return;
        }

        if (! empty($settings['smtp_host'])) {
            config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => $settings['smtp_host']]);
        }

        if (! empty($settings['smtp_port'])) {
            config(['mail.mailers.smtp.port' => (int) $settings['smtp_port']]);
        }

        if (! empty($settings['smtp_user'])) {
            config(['mail.mailers.smtp.username' => $settings['smtp_user']]);
        }

        if (! empty($settings['smtp_password'])) {
            config(['mail.mailers.smtp.password' => $settings['smtp_password']]);
        }

        if (! empty($settings['smtp_from'])) {
            config(['mail.from.address' => $settings['smtp_from']]);
        }
    }
}
