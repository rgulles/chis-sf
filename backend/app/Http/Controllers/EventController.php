<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function index()
    {
        return Event::all();
    }

    public function show(Event $event)
    {
        return $event;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'event_date' => 'required|date',
            'location' => 'required|string|max:255',
            'image_path' => 'nullable|string|max:255',
            'status' => 'nullable|in:upcoming,ongoing,completed,cancelled',
        ]);

        $data['created_by'] = $request->user()->id;

        $event = Event::create($data);

        return response()->json($event, 201);
    }

    public function update(Request $request, Event $event)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'event_date' => 'sometimes|date',
            'location' => 'sometimes|string|max:255',
            'image_path' => 'nullable|string|max:255',
            'status' => 'sometimes|in:upcoming,ongoing,completed,cancelled',
        ]);

        $event->update($data);

        return response()->json($event);
    }

    public function destroy(Event $event)
    {
        $event->update([
            'status' => 'cancelled',
        ]);

        return response()->json([
            'message' => 'Event cancelled successfully.',
        ]);
    }
}
