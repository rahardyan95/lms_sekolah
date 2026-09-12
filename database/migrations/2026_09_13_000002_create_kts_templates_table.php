<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kts_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->json('colors');
            $table->json('visibility');
            $table->string('watermark')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('active')->default(false);
            $table->timestamps();

            $table->index(['active', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kts_templates');
    }
};
