<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItineraryStop extends Model
{
    protected $fillable = ['heritage_site_id', 'sort_order'];

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class);
    }
}
