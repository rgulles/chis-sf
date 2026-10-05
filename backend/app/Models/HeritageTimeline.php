<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class HeritageTimeline extends Model
{
    use HasFactory;

    protected $fillable = ['heritage_site_id', 'year', 'title', 'description'];

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class);
    }
}
