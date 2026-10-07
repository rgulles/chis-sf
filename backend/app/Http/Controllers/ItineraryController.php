<?php

namespace App\Http\Controllers;

use App\Models\HeritageSite;
use App\Models\Itinerary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ItineraryController extends Controller
{
    private function publicRelations(): array
    {
        return ['stops' => fn ($query) => $query->whereHas('heritageSite', fn ($site) => $site->where('status', 'active')),
            'stops.heritageSite.images', 'stops.heritageSite.timelines'];
    }

    public function index()
    {
        return Itinerary::where('status', 'active')->with($this->publicRelations())->orderBy('id')->get();
    }

    public function show(Itinerary $itinerary)
    {
        abort_unless($itinerary->status === 'active', 404);

        return $itinerary->load($this->publicRelations());
    }

    public function adminIndex()
    {
        return Itinerary::with(['stops.heritageSite.images', 'stops.heritageSite.timelines'])->orderBy('id')->get();
    }

    public function adminShow(Itinerary $itinerary)
    {
        return $itinerary->load(['stops.heritageSite.images', 'stops.heritageSite.timelines']);
    }

    private function validated(Request $request, ?Itinerary $itinerary = null): array
    {
        $data = $request->validate([
            'name' => ($itinerary ? 'sometimes' : 'required').'|string|max:255',
            'description' => 'sometimes|nullable|string|max:10000',
            'status' => 'sometimes|in:active,archived',
            'stops' => ($itinerary ? 'sometimes' : 'required').'|array|max:100',
            'stops.*.heritage_site_id' => 'required|integer|distinct|exists:heritage_sites,id',
            'stops.*.sort_order' => 'required|integer|min:0|max:10000',
        ]);
        $retained = $itinerary?->stops()->pluck('heritage_site_id')->map(fn ($id) => (int) $id)->all() ?? [];
        foreach ($data['stops'] ?? [] as $index => $stop) {
            if (! in_array((int) $stop['heritage_site_id'], $retained, true)
                && ! HeritageSite::whereKey($stop['heritage_site_id'])->where('status', 'active')->exists()) {
                throw ValidationException::withMessages(["stops.$index.heritage_site_id" => 'Only active heritage sites can be added as new stops.']);
            }
        }

        return $data;
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $itinerary = DB::transaction(function () use ($data, $request) {
            $itinerary = Itinerary::create([...collect($data)->except('stops')->all(), 'created_by' => $request->user()->id]);
            $itinerary->stops()->createMany($data['stops']);

            return $itinerary;
        });

        return response()->json($this->adminShow($itinerary), 201);
    }

    public function update(Request $request, Itinerary $itinerary)
    {
        $data = $this->validated($request, $itinerary);
        DB::transaction(function () use ($data, $itinerary) {
            $itinerary->update(collect($data)->except('stops')->all());
            if (array_key_exists('stops', $data)) {
                $itinerary->stops()->delete();
                $itinerary->stops()->createMany($data['stops']);
            }
        });

        return $this->adminShow($itinerary);
    }

    public function destroy(Itinerary $itinerary)
    {
        $itinerary->update(['status' => 'archived']);

        return response()->json(['message' => 'Itinerary archived.']);
    }
}
