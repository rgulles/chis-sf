<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeritageCheckinConfig extends Model
{
    // Deprecated token columns remain only for compatibility with existing databases.
    protected $hidden = ['public_token', 'token_rotated_at'];

    protected $fillable = ['heritage_site_id', 'public_token', 'radius_meters', 'enabled', 'created_by', 'token_rotated_at'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'radius_meters' => 'integer', 'token_rotated_at' => 'datetime'];
    }

    public function heritageSite(): BelongsTo
    {
        return $this->belongsTo(HeritageSite::class);
    }

    public static function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }
}
