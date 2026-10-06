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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(EventSchedule::class)->orderBy('id', 'asc');
    }
}
