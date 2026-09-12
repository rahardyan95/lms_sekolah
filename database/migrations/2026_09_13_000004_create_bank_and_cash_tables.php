<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('bank');
            // Nomor lengkap terenkripsi; versi ter-mask dipakai untuk tampilan.
            $table->text('account_number');
            $table->string('account_masked', 32);
            $table->string('holder');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cash_transactions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 16);
            $table->string('category', 64);
            $table->unsignedBigInteger('amount');
            $table->timestamp('transaction_at');
            $table->string('proof')->nullable();
            $table->string('pic')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['type', 'transaction_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_transactions');
        Schema::dropIfExists('bank_accounts');
    }
};
