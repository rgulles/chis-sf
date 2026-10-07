<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeritageVisit extends Model
{
    protected $fillable = ['user_id', 'heritage_site_id', 'verification_method', 'distance_meters', 'accuracy_meters', 'points_awarded', 'verified_at'];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime', 'points_awarded' => 'integer'];
    }

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class);
    }
}
