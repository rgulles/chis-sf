<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_images', function (Blueprint $table) {
            $table->boolean('is_cover')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('site_images', function (Blueprint $table) {
            $table->dropColumn(['is_cover', 'sort_order']);
        });
    }
};
