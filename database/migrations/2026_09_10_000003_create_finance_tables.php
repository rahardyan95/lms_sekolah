<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('category', 64)->default('SPP');
            $table->unsignedBigInteger('amount');
            $table->string('academic_year', 16)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUlid('item_id')->nullable()->constrained('payment_items')->nullOnDelete();
            $table->string('title');
            $table->string('period', 16)->nullable();
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('paid_amount')->default(0);
            $table->string('status', 16)->default('unpaid');
            $table->date('due_date')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'item_id', 'period']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('method', 32)->default('tunai');
            $table->string('reference', 64)->unique();
            $table->string('receipt_number', 32)->unique();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at');
            $table->string('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payment_items');
    }
};
