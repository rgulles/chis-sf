<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class EventController extends Controller
{
    public function index()
    {
        return Event::with('schedules')->orderBy('event_date', 'asc')->get();
    }

    public function show(Event $event)
    {
        return $event->load('schedules');
    }

    public function store(Request $request)
    {
        if ($request->has('tags') && is_string($request->input('tags'))) {
            $request->merge(['tags' => json_decode($request->input('tags'), true) ?? []]);
        }
        if ($request->has('schedules') && is_string($request->input('schedules'))) {
            $request->merge(['schedules' => json_decode($request->input('schedules'), true) ?? []]);
        }

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'nullable|string|max:100',
            'description' => 'required|string',
            'event_date' => 'required|date',
            'end_date' => 'nullable|date',
            'start_time' => 'nullable|string|max:50',
            'end_time' => 'nullable|string|max:50',
            'location' => 'required|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp,svg|max:5120',
            'image_path' => 'nullable|string|max:255',
            'status' => 'nullable|in:upcoming,ongoing,completed,cancelled',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'schedules' => 'nullable|array',
            'schedules.*.schedule_time' => 'nullable|string|max:50',
            'schedules.*.title' => 'nullable|string|max:255',
            'schedules.*.description' => 'nullable|string',
        ]);

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('events', 's3');
            $data['image_path'] = $path;
        }
        unset($data['image']);

        $data['created_by'] = $request->user()->id;

        $event = DB::transaction(function () use ($data) {
            $schedules = $data['schedules'] ?? [];
            unset($data['schedules']);

            $event = Event::create($data);
        \App\Models\AdminActivity::log("created", "Event", $event->title);

            if (!empty($schedules)) {
                foreach ($schedules as $item) {
                    $event->schedules()->create([
                        'schedule_time' => $item['schedule_time'] ?? $item['time'] ?? '',
                        'title' => $item['title'] ?? $item['activity'] ?? '',
                        'description' => $item['description'] ?? '',
                    ]);
                }
            }

            return $event;
        });

        return response()->json($event->load('schedules'), 201);
    }

    public function update(Request $request, Event $event)
    {
        if ($request->has('tags') && is_string($request->input('tags'))) {
            $request->merge(['tags' => json_decode($request->input('tags'), true) ?? []]);
        }
        if ($request->has('schedules') && is_string($request->input('schedules'))) {
            $request->merge(['schedules' => json_decode($request->input('schedules'), true) ?? []]);
        }

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'category' => 'nullable|string|max:100',
            'description' => 'sometimes|string',
            'event_date' => 'sometimes|date',
            'end_date' => 'nullable|date',
            'start_time' => 'nullable|string|max:50',
            'end_time' => 'nullable|string|max:50',
            'location' => 'sometimes|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp,svg|max:5120',
            'image_path' => 'nullable|string|max:255',
            'status' => 'sometimes|in:upcoming,ongoing,completed,cancelled',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'schedules' => 'nullable|array',
            'schedules.*.id' => 'nullable',
            'schedules.*.schedule_time' => 'nullable|string|max:50',
            'schedules.*.title' => 'nullable|string|max:255',
            'schedules.*.description' => 'nullable|string',
        ]);

        if ($request->hasFile('image')) {
            if ($event->image_path && !str_starts_with($event->image_path, 'http') && !str_starts_with($event->image_path, '/images/')) {
                $cleanPath = str_replace('storage/', '', $event->image_path);
                Storage::disk('s3')->delete($cleanPath);
                Storage::disk('public')->delete($cleanPath);
            }
            $path = $request->file('image')->store('events', 's3');
            $data['image_path'] = $path;
        }
        unset($data['image']);

        DB::transaction(function () use ($event, $data, $request) {
            $hasSchedules = array_key_exists('schedules', $data);
            $schedules = $data['schedules'] ?? [];
            unset($data['schedules']);

            $event->update($data);
        \App\Models\AdminActivity::log("updated", "Event", $event->title);

            if ($hasSchedules) {
                $event->schedules()->delete();
                foreach ($schedules as $item) {
                    $event->schedules()->create([
                        'schedule_time' => $item['schedule_time'] ?? $item['time'] ?? '',
                        'title' => $item['title'] ?? $item['activity'] ?? '',
                        'description' => $item['description'] ?? '',
                    ]);
                }
            }
        });

        return response()->json($event->load('schedules'));
    }

    public function destroy(Event $event)
    {
        if ($event->image_path && !str_starts_with($event->image_path, 'http') && !str_starts_with($event->image_path, '/images/')) {
            $cleanPath = str_replace('storage/', '', $event->image_path);
            Storage::disk('s3')->delete($cleanPath);
            Storage::disk('public')->delete($cleanPath);
        }

        $event->delete();

        return response()->json([
            'message' => 'Event deleted successfully.',
        ]);
    }
}
