<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kts_tokens', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->string('jti', 32)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('broadcasts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->text('body');
            $table->string('audience', 32);
            $table->string('status', 16)->default('queued');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('broadcast_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('broadcast_id')->constrained('broadcasts')->cascadeOnDelete();
            $table->string('recipient_name');
            $table->text('recipient_phone');
            $table->string('status', 16)->default('pending');
            $table->text('provider_response')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('broadcast_logs');
        Schema::dropIfExists('broadcasts');
        Schema::dropIfExists('kts_tokens');
    }
};
