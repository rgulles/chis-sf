<?php

namespace App\Http\Controllers;

use App\Models\HeritageSite;
use Illuminate\Http\Request;

class HeritageSiteController extends Controller
{
    public function index()
    {
        return HeritageSite::with(['images', 'timelines'])->get();
    }

    public function show(HeritageSite $heritageSite)
    {
        return $heritageSite->load(['images', 'timelines']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'year_built' => 'nullable|string|max:255',
            'description' => 'required|string',
            'history' => 'required|string',
            'address' => 'required|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'status' => 'nullable|in:active,archived',
        ]);

        $data['created_by'] = $request->user()->id;

        $heritageSite = HeritageSite::create($data);

        return response()->json($heritageSite, 201);
    }

    public function update(Request $request, HeritageSite $heritageSite)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => 'nullable|string|max:255',
            'year_built' => 'nullable|string|max:255',
            'description' => 'sometimes|string',
            'history' => 'sometimes|string',
            'address' => 'sometimes|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'status' => 'sometimes|in:active,archived',
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
}
