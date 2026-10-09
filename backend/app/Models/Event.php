<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Throwable;

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
        try {
            $value = trim((string) $this->image_path);
            if ($value === '') {
                return null;
            }
            if (preg_match('#^https?://#i', $value)) {
                return filter_var($value, FILTER_VALIDATE_URL) ? $value : null;
            }
            // Reject traversal, control characters and non-HTTP schemes; never alter the stored path.
            if (preg_match('#(^|/)\.\.(?:/|$)|[\x00-\x1f\\\\]|^[a-z][a-z0-9+.-]*:#i', $value)) {
                return null;
            }
            if (str_starts_with($value, '/images/')) {
                return $value;
            }
            $path = ltrim($value, '/');
            $publicBase = rtrim(config('filesystems.disks.public.url') ?: url('/storage'), '/');
            if (str_starts_with($path, 'storage/')) {
                return $publicBase.'/'.substr($path, strlen('storage/'));
            }
            // Bare object keys can be old public uploads or S3 uploads. One local stat,
            // rather than Storage::exists or an S3 HEAD, resolves the local case.
            $publicRoot = config('filesystems.disks.public.root');
            if (config('filesystems.disks.public.driver') === 'local' && $publicRoot && is_file($publicRoot.DIRECTORY_SEPARATOR.$path)) {
                return $publicBase.'/'.$path;
            }
            $config = config('filesystems.disks.s3', []);
            // An explicitly configured public/CDN base needs no SDK or remote lookup.
            if (! empty($config['url']) && filter_var($config['url'], FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $config['url'])) {
                $key = implode('/', array_map('rawurlencode', explode('/', trim(($config['root'] ?? '').'/'.$path, '/'))));

                return rtrim($config['url'], '/').'/'.$key;
            }
            if (($config['driver'] ?? null) !== 's3' || empty($config['bucket']) || empty($config['region'])) {
                return null;
            }
            if (($config['visibility'] ?? null) === 'public') {
                return Storage::disk('s3')->url($path);
            }
            // Do not invoke network-based credential discovery while serializing an event list.
            // With explicit credentials, presigning is local and does not check object existence.
            if (empty($config['key']) || empty($config['secret'])) {
                return null;
            }

            return Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(60));
        } catch (Throwable) {
            // An unavailable image must never prevent the event and schedules from serializing.
            return null;
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
