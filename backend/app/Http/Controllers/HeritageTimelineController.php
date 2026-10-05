<?php

namespace App\Http\Controllers;

use App\Models\HeritageTimeline;
use Illuminate\Http\Request;

class HeritageTimelineController extends Controller
{
    public function index($heritageSiteId)
    {
        $timelines = HeritageTimeline::where('heritage_site_id', $heritageSiteId)
                        ->orderBy('year', 'asc')
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
        ]);

        $timeline = HeritageTimeline::create($data);

        return response()->json($timeline, 201);
    }

    public function show(HeritageTimeline $heritageTimeline)
    {
        return response()->json($heritageTimeline);
    }

    public function update(Request $request, HeritageTimeline $heritageTimeline)
    {
        $data = $request->validate([
            'year' => 'sometimes|string|max:255',
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
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
