<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subjects', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('category', 32)->default('Wajib');
            $table->unsignedInteger('kkm')->default(75);
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_type', 16)->default('PDF');
            $table->string('path')->nullable();
            $table->string('original_name')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('kelas')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('assignments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('deadline');
            $table->string('kelas')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('submissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 64);
            $table->unsignedBigInteger('size');
            $table->timestamp('submitted_at');
            $table->unsignedInteger('score')->nullable();
            $table->text('feedback')->nullable();
            $table->string('status', 16)->default('submitted');
            $table->timestamps();
            $table->unique(['assignment_id', 'student_id']);
        });

        Schema::create('grades', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUlid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->unsignedInteger('nilai_tugas')->nullable();
            $table->unsignedInteger('nilai_uts')->nullable();
            $table->unsignedInteger('nilai_uas')->nullable();
            $table->unsignedInteger('nilai_akhir')->nullable();
            $table->string('predikat', 4)->nullable();
            $table->text('catatan_guru')->nullable();
            $table->boolean('published')->default(false);
            $table->timestamps();
            $table->unique(['student_id', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
        Schema::dropIfExists('submissions');
        Schema::dropIfExists('assignments');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('subjects');
    }
};
