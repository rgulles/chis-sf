<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminActivity extends Model
{
    protected $fillable = [
        'action',
        'model_type',
        'model_name',
        'admin_id',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public static function log(string $action, string $modelType, string $modelName)
    {
        if (auth()->check()) {
            self::create([
                'action' => $action,
                'model_type' => $modelType,
                'model_name' => $modelName,
                'admin_id' => auth()->id(),
            ]);
        }
    }
}
