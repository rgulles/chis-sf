<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeritageContributionImage extends Model
{
    protected $fillable = ['image_path', 'sort_order'];

    public function contribution(): BelongsTo
    {
        return $this->belongsTo(HeritageContribution::class, 'heritage_contribution_id');
    }
}
