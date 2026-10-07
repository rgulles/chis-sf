<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('itineraries', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active')->index();
            $table->string('source_key')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
        Schema::create('itinerary_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('heritage_site_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('sort_order');
            $table->timestamps();
            $table->unique(['itinerary_id', 'heritage_site_id']);
            $table->index(['itinerary_id', 'sort_order', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itinerary_stops');
        Schema::dropIfExists('itineraries');
    }
};
