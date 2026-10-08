<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HeritageContribution extends Model
{
    protected $fillable = ['user_id', 'heritage_site_id', 'caption', 'status', 'approved_by', 'approved_at', 'rejected_at'];

    protected function casts(): array
    {
        return ['approved_at' => 'datetime', 'rejected_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(HeritageContributionImage::class)->orderBy('sort_order')->orderBy('id');
    }
}
