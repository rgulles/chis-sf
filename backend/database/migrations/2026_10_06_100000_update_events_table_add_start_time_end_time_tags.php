<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            if (!Schema::hasColumn('events', 'start_time')) {
                $table->string('start_time')->nullable()->after('event_date');
            }
            if (!Schema::hasColumn('events', 'end_time')) {
                $table->string('end_time')->nullable()->after('start_time');
            }
            if (!Schema::hasColumn('events', 'tags')) {
                $table->json('tags')->nullable()->after('image_path');
            }
            if (!Schema::hasColumn('events', 'category')) {
                $table->string('category')->nullable()->default('Festival')->after('title');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['start_time', 'end_time', 'tags', 'category']);
        });
    }
};
