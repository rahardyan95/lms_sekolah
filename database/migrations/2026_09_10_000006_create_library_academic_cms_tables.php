<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->string('author');
            $table->string('publisher')->nullable();
            $table->string('isbn', 32)->nullable()->unique();
            $table->unsignedInteger('year')->nullable();
            $table->string('category')->nullable();
            $table->unsignedInteger('physical_stock')->default(0);
            $table->string('ebook_path')->nullable();
            $table->unsignedInteger('page_count')->nullable();
            $table->text('summary')->nullable();
            $table->timestamps();
        });

        Schema::create('book_loans', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('book_id')->constrained('books')->cascadeOnDelete();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->timestamp('borrowed_at');
            $table->timestamp('due_at');
            $table->timestamp('returned_at')->nullable();
            $table->string('status', 16)->default('borrowed');
            $table->timestamps();
        });

        Schema::create('schedules', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('day', 16);
            $table->string('time_start', 5);
            $table->string('time_end', 5);
            $table->string('kelas');
            $table->foreignUlid('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->string('subject_name');
            $table->string('teacher_name');
            $table->string('room')->nullable();
            $table->timestamps();
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->text('content');
            $table->string('target_role', 32)->default('Semua');
            $table->boolean('is_important')->default(false);
            $table->boolean('published')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('posts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category')->nullable();
            $table->text('excerpt')->nullable();
            $table->longText('content');
            $table->string('image_url')->nullable();
            $table->json('tags')->nullable();
            $table->string('status', 16)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('schedules');
        Schema::dropIfExists('book_loans');
        Schema::dropIfExists('books');
    }
};
