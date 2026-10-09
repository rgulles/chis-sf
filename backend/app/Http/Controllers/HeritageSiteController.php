<?php

namespace App\Http\Controllers;

use App\Models\HeritageSite;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use App\Services\HeritageVisitAvailability;

class HeritageSiteController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['search' => 'sometimes|nullable|string|max:500']);
        $query = HeritageSite::select(['id', 'name', 'category', 'year_built', 'address', 'latitude', 'longitude', 'description', 'status'])
            ->with('coverImage')->where('status', 'active');
        // Search retains full description/history matching without shipping those texts in the catalogue.
        if (filled($data['search'] ?? null)) {
            $needle = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($data['search'])).'%';
            $query->where(function ($query) use ($needle) {
                foreach (['name', 'address', 'category', 'description', 'history'] as $field) {
                    $query->orWhereRaw("LOWER({$field}) LIKE LOWER(?) ESCAPE '!'", [$needle]);
                }
            });
        }
        return $query->get()->map(fn ($site) => [...$site->only(['id', 'name', 'category', 'year_built', 'address', 'latitude', 'longitude', 'status']),
            'short_description' => Str::limit($site->description ?? '', 240),
            'cover_image' => $site->coverImage?->only(['id', 'image_path', 'caption', 'is_cover', 'sort_order'])]);
    }

    public function adminIndex()
    {
        return HeritageSite::with(['images', 'timelines'])->get();
    }

    public function show(string $heritageSite)
    {
        $site = HeritageVisitAvailability::withEnabledConfig(
            HeritageSite::whereKey($heritageSite)->where('status', 'active')->with(['images', 'timelines'])
        )->firstOrFail();
        $data = $site->toArray();
        unset($data['verification_config_enabled'], $data['created_by']);
        return [...$data, 'visit_verification_enabled' => HeritageVisitAvailability::enabled($site)];
    }

    public function adminShow(HeritageSite $heritageSite)
    {
        return $heritageSite->load(['images', 'timelines']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => ['nullable', Rule::in(HeritageSite::CATEGORIES)],
            'year_built' => 'nullable|string|max:255',
            'description' => 'required|string',
            'history' => 'required|string',
            'address' => 'required|string|max:255',
            'latitude' => 'nullable|present_with:longitude|required_with:longitude|numeric|between:-90,90',
            'longitude' => 'nullable|present_with:latitude|required_with:latitude|numeric|between:-180,180',
            'status' => 'nullable|in:active,archived',
            ...$this->visitorInformationRules(),
        ]);

        $data['created_by'] = $request->user()->id;

        $heritageSite = HeritageSite::create($data);
        \App\Models\AdminActivity::log("created", "HeritageSite", $heritageSite->name);

        return response()->json($heritageSite, 201);
    }

    public function update(Request $request, HeritageSite $heritageSite)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => ['nullable', Rule::in(HeritageSite::CATEGORIES)],
            'year_built' => 'nullable|string|max:255',
            'description' => 'sometimes|string',
            'history' => 'sometimes|string',
            'address' => 'sometimes|string|max:255',
            'latitude' => 'nullable|present_with:longitude|required_with:longitude|numeric|between:-90,90',
            'longitude' => 'nullable|present_with:latitude|required_with:latitude|numeric|between:-180,180',
            'status' => 'sometimes|in:active,archived',
            ...$this->visitorInformationRules(),
        ]);

        $heritageSite->update($data);
        \App\Models\AdminActivity::log(isset($data["status"]) && $data["status"] === "archived" ? "archived" : "updated", "HeritageSite", $heritageSite->name);

        return response()->json($heritageSite);
    }

    public function destroy(HeritageSite $heritageSite)
    {
        $heritageSite->update([
            'status' => 'archived',
        ]);

        return response()->json([
            'message' => 'Heritage site archived successfully.',
        ]);
    }

    private function visitorInformationRules(): array
    {
        // Laravel's TrimStrings / ConvertEmptyStringsToNull middleware normalizes blanks.
        return [
            'opening_hours' => 'sometimes|nullable|string|max:1000',
            'entrance_fee' => 'sometimes|nullable|string|max:1000',
            'accessibility_notes' => 'sometimes|nullable|string|max:3000',
            'visit_notes' => 'sometimes|nullable|string|max:3000',
            'contact_information' => 'sometimes|nullable|string|max:2000',
        ];
    }
}
