<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cbt_exams', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->string('subject_name');
            $table->string('kelas');
            $table->unsignedInteger('duration_minutes');
            $table->date('date');
            $table->string('time_start', 5);
            $table->string('time_end', 5);
            $table->string('status', 16)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('cbt_questions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('exam_id')->constrained('cbt_exams')->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->text('question');
            $table->json('options');
            $table->char('correct_answer', 1);
            $table->text('explanation')->nullable();
            $table->timestamps();
            $table->unique(['exam_id', 'number']);
        });

        Schema::create('cbt_attempts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('exam_id')->constrained('cbt_exams')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedInteger('score')->nullable();
            $table->timestamps();
        });

        Schema::create('cbt_answers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('attempt_id')->constrained('cbt_attempts')->cascadeOnDelete();
            $table->foreignUlid('question_id')->constrained('cbt_questions')->cascadeOnDelete();
            $table->char('answer', 1);
            $table->boolean('hesitant')->default(false);
            $table->timestamps();
            $table->unique(['attempt_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cbt_answers');
        Schema::dropIfExists('cbt_attempts');
        Schema::dropIfExists('cbt_questions');
        Schema::dropIfExists('cbt_exams');
    }
};
