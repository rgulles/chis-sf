<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Itinerary extends Model
{
    protected $fillable = ['name', 'description', 'status', 'created_by', 'source_key'];

    protected $hidden = ['source_key'];
    protected $attributes = ['status' => 'active'];

    public function stops(): HasMany
    {
        return $this->hasMany(ItineraryStop::class)->orderBy('sort_order')->orderBy('id');
    }
}
