<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('heritage_checkin_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('heritage_site_id')->unique()->constrained()->restrictOnDelete();
            $table->string('public_token', 64)->unique();
            $table->unsignedInteger('radius_meters')->default(100);
            $table->boolean('enabled')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('token_rotated_at')->nullable();
            $table->timestamps();
        });
        Schema::create('heritage_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('heritage_site_id')->constrained()->restrictOnDelete();
            $table->string('verification_method')->default('qr_geofence');
            $table->decimal('distance_meters', 10, 2);
            $table->decimal('accuracy_meters', 10, 2)->nullable();
            $table->unsignedInteger('points_awarded');
            $table->timestamp('verified_at');
            $table->timestamps();
            $table->unique(['user_id', 'heritage_site_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('heritage_visits');
        Schema::dropIfExists('heritage_checkin_configs');
    }
};
