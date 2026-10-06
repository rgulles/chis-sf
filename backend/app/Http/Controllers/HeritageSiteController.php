<?php

namespace App\Http\Controllers;

use App\Models\HeritageSite;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HeritageSiteController extends Controller
{
    public function index()
    {
        return HeritageSite::with(['images', 'timelines'])->where('status', 'active')->get();
    }

    public function adminIndex()
    {
        return HeritageSite::with(['images', 'timelines'])->get();
    }

    public function show(HeritageSite $heritageSite)
    {
        abort_unless($heritageSite->status === 'active', 404);

        return $this->adminShow($heritageSite);
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
