<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('identifier')->nullable()->unique()->after('email');
            $table->string('status')->default('active')->after('password');
        });

        Schema::create('academic_years', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('label');
            $table->date('starts_at');
            $table->date('ends_at');
            $table->boolean('active')->default(false);
            $table->timestamps();
        });

        Schema::create('class_rooms', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('grade');
            $table->string('major')->nullable();
            $table->foreignUlid('academic_year_id')->nullable()->constrained('academic_years')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('students', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nisn')->unique();
            $table->text('nik')->nullable();
            $table->string('name');
            $table->string('gender', 16)->nullable();
            $table->string('birth_place')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('photo_path')->nullable();
            $table->foreignUlid('class_room_id')->nullable()->constrained('class_rooms')->nullOnDelete();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('guardians', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->text('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('guardian_student', function (Blueprint $table) {
            $table->foreignUlid('guardian_id')->constrained('guardians')->cascadeOnDelete();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->primary(['guardian_id', 'student_id']);
        });

        Schema::create('attendances', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('date');
            $table->time('time_in')->nullable();
            $table->time('time_out')->nullable();
            $table->string('status', 32);
            $table->string('source', 32)->default('qr');
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('device')->nullable();
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->timestamps();
            $table->unique(['student_id', 'date']);
        });

        Schema::create('otp_codes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('identifier', 64)->index();
            $table->string('purpose', 64);
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamps();
        });

        Schema::create('school_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->string('action');
            $table->string('entity')->nullable();
            $table->string('entity_id')->nullable();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('request_id', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('school_settings');
        Schema::dropIfExists('otp_codes');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('guardian_student');
        Schema::dropIfExists('guardians');
        Schema::dropIfExists('students');
        Schema::dropIfExists('class_rooms');
        Schema::dropIfExists('academic_years');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['identifier', 'status']);
        });
    }
};
