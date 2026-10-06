<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HeritageSite extends Model
{
    public const CATEGORIES = ['Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites'];

    protected $fillable = [
        'created_by',
        'name',
        'category',
        'year_built',
        'description',
        'history',
        'address',
        'latitude',
        'longitude',
        'status',
        'opening_hours',
        'entrance_fee',
        'accessibility_notes',
        'visit_notes',
        'contact_information',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(SiteImage::class, 'heritage_site_id')->orderBy('sort_order')->orderBy('id');
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(HeritageTimeline::class, 'heritage_site_id')->orderBy('sort_order')->orderBy('id');
    }
}
