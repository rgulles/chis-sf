<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'category',
        'description',
        'event_date',
        'end_date',
        'start_time',
        'end_time',
        'location',
        'image_path',
        'status',
        'tags',
    ];

    protected $casts = [
        'tags' => 'array',
    ];

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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(EventSchedule::class)->orderBy('id', 'asc');
    }
}
