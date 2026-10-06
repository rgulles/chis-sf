<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('heritage_sites', function (Blueprint $table) {
            $table->text('opening_hours')->nullable();
            $table->text('entrance_fee')->nullable();
            $table->text('accessibility_notes')->nullable();
            $table->text('visit_notes')->nullable();
            $table->text('contact_information')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('heritage_sites', function (Blueprint $table) {
            $table->dropColumn(['opening_hours', 'entrance_fee', 'accessibility_notes', 'visit_notes', 'contact_information']);
        });
    }
};
