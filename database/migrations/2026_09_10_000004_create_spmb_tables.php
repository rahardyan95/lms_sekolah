<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spmb_waves', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('quota');
            $table->unsignedBigInteger('fee')->default(0);
            $table->boolean('active')->default(false);
            $table->timestamps();
        });

        Schema::create('spmb_applications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('registration_number', 32)->unique();
            $table->foreignUlid('wave_id')->constrained('spmb_waves')->cascadeOnDelete();
            $table->string('name');
            $table->string('nisn', 20)->unique();
            $table->text('nik')->nullable();
            $table->string('gender', 8);
            $table->string('birth_place')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('parent_name');
            $table->text('parent_phone')->nullable();
            $table->string('previous_school')->nullable();
            $table->decimal('average_score', 5, 2)->nullable();
            $table->string('chosen_major')->nullable();
            $table->string('status', 16)->default('draft');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignUlid('converted_student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('spmb_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('application_id')->constrained('spmb_applications')->cascadeOnDelete();
            $table->string('kind', 32);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 64);
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spmb_files');
        Schema::dropIfExists('spmb_applications');
        Schema::dropIfExists('spmb_waves');
    }
};
