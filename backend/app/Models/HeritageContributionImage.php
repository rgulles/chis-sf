<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeritageContributionImage extends Model
{
    protected $fillable = ['image_path', 'sort_order'];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (empty($this->image_path)) {
            return null;
        }

        if (preg_match('#^https?://#i', $this->image_path)) {
            return $this->image_path;
        }

        if (\Illuminate\Support\Facades\Storage::disk('public')->exists($this->image_path)) {
            return \Illuminate\Support\Facades\Storage::disk('public')->url($this->image_path);
        }

        $s3 = \Illuminate\Support\Facades\Storage::disk('s3');
        if (config('filesystems.disks.s3.visibility') === 'public' || env('AWS_URL')) {
            return $s3->url($this->image_path);
        }
        
        try {
            return $s3->temporaryUrl($this->image_path, now()->addMinutes(60));
        } catch (\Exception $e) {
            return $s3->url($this->image_path);
        }
    }

    public function contribution(): BelongsTo
    {
        return $this->belongsTo(HeritageContribution::class, 'heritage_contribution_id');
    }
}
