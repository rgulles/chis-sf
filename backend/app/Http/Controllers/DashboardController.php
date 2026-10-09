<?php

namespace App\Http\Controllers;

use App\Models\HeritageSite;
use App\Models\Event;
use App\Models\User;
use App\Models\HeritageContribution;
use App\Models\AdminActivity;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        // 1. Summary Cards
        $totalHeritageSites = HeritageSite::count();
        $totalEvents = Event::count();
        $registeredVisitors = User::where('role', 'traveler')->count();
        $pendingContributions = HeritageContribution::where('status', 'pending')->count();

        // 2. Popular Heritage Sites
        $popularSites = HeritageSite::select('id', 'name')
            ->where('status', 'active')
            ->withCount('visits')
            ->orderByDesc('visits_count')
            ->limit(5)
            ->get();

        // 3. Upcoming Events
        $now = Carbon::now();
        $upcomingEvents = Event::where('status', '!=', 'cancelled')
            ->where(function($query) use ($now) {
                $query->whereDate('event_date', '>', $now->toDateString())
                      ->orWhere(function($q) use ($now) {
                          $q->whereDate('event_date', '=', $now->toDateString())
                            ->whereTime('start_time', '>=', $now->toTimeString());
                      });
            })
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->limit(5)
            ->get();

        // 4. Recent Admin Activity
        $recentActivity = AdminActivity::with('admin:id,name,email')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'summary' => [
                'total_heritage_sites' => $totalHeritageSites,
                'total_events' => $totalEvents,
                'registered_visitors' => $registeredVisitors,
                'pending_contributions' => $pendingContributions,
            ],
            'popular_sites' => $popularSites,
            'upcoming_events' => $upcomingEvents,
            'recent_activity' => $recentActivity,
        ]);
    }
}
