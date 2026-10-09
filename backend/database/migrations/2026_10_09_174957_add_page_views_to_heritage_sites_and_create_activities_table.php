<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('heritage_sites', function (Blueprint $table) {
            $table->unsignedBigInteger('page_views')->default(0);
        });

        Schema::create('admin_activities', function (Blueprint $table) {
            $table->id();
            $table->string('action'); // e.g., 'created', 'updated', 'published', 'archived', 'approved', 'rejected'
            $table->string('model_type'); // e.g., 'HeritageSite', 'Event', 'VisitorContribution'
            $table->string('model_name'); // e.g. the actual name or title of the model
            $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_activities');
        Schema::table('heritage_sites', function (Blueprint $table) {
            $table->dropColumn('page_views');
        });
    }
};
