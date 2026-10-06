<?php

namespace App\Http\Controllers;

use App\Models\HeritageTimeline;
use App\Models\HeritageSite;
use Illuminate\Http\Request;

class HeritageTimelineController extends Controller
{
    public function index($heritageSiteId)
    {
        HeritageSite::where('status', 'active')->findOrFail($heritageSiteId);

        $timelines = HeritageTimeline::where('heritage_site_id', $heritageSiteId)
                        ->orderBy('sort_order')->orderBy('id')
                        ->get();
        return response()->json($timelines);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'heritage_site_id' => 'required|exists:heritage_sites,id',
            'year' => 'required|string|max:255',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'sort_order' => 'sometimes|required|integer|min:0|max:2147483647',
        ]);

        $timeline = HeritageTimeline::create($data);

        return response()->json($timeline, 201);
    }

    public function show(HeritageTimeline $heritageTimeline)
    {
        abort_unless($heritageTimeline->heritageSite?->status === 'active', 404);

        return response()->json($heritageTimeline);
    }

    public function update(Request $request, HeritageTimeline $heritageTimeline)
    {
        $data = $request->validate([
            'heritage_site_id' => 'sometimes|required|integer|exists:heritage_sites,id',
            'year' => 'sometimes|string|max:255',
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'sort_order' => 'sometimes|required|integer|min:0|max:2147483647',
        ]);

        $heritageTimeline->update($data);

        return response()->json($heritageTimeline);
    }

    public function destroy(HeritageTimeline $heritageTimeline)
    {
        $heritageTimeline->delete();
        return response()->json(null, 204);
    }
}
