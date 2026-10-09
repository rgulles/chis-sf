<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteImage extends Model
{
    protected $fillable = [
        'heritage_site_id',
        'image_path',
        'caption',
        'is_cover',
        'sort_order',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return ['is_cover' => 'boolean', 'sort_order' => 'integer'];
    }

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class, 'heritage_site_id');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (empty($this->image_path)) {
            return null;
        }

        if (preg_match('#^https?://#i', $this->image_path)) {
            return $this->image_path;
        }

        // Fast local check: if it exists locally, return local URL.
        if (\Illuminate\Support\Facades\Storage::disk('public')->exists($this->image_path)) {
            return \Illuminate\Support\Facades\Storage::disk('public')->url($this->image_path);
        }

        // Otherwise assume S3. Generate temporary URL if private, or public URL if AWS_URL is configured/public.
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
}
