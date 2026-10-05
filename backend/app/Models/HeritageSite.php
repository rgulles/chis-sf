<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HeritageSite extends Model
{
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
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(SiteImage::class, 'heritage_site_id');
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(HeritageTimeline::class, 'heritage_site_id')->orderBy('year', 'asc');
    }
}
