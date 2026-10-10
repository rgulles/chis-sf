<?php

namespace Database\Seeders;

use App\Models\HeritageSite;
use App\Models\Itinerary;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use LogicException;

class SanFernandoItinerarySeeder extends Seeder
{
    public const SOURCE_PREFIX = 'chis-curated-itinerary-v1/';

    public function run(): void
    {
        if (! Schema::hasColumn('itineraries', 'source_key')) {
            throw new LogicException('The existing itinerary source_key column is required; no records were inserted.');
        }

        $plans = require database_path('data/san_fernando_itineraries.php');
        $inserted = 0;
        $skipped = 0;

        DB::transaction(function () use ($plans, &$inserted, &$skipped): void {
            // Validate every plan and lock its existing destinations before writing any records.
            $prepared = [];
            $keys = [];
            foreach ($plans as $plan) {
                if (isset($keys[$plan['key']])) {
                    throw new LogicException('Duplicate curated itinerary key.');
                }
                $keys[$plan['key']] = true;
                $prepared[] = $this->prepare($plan);
            }

            foreach ($prepared as $record) {
                // Create only. Never adopt/overwrite an Admin record with a matching title,
                // and never replace an imported itinerary that an Admin has subsequently edited.
                if (Itinerary::where('source_key', $record['source_key'])->exists()
                    || Itinerary::where('name', $record['name'])->exists()) {
                    $skipped++;
                    $this->command?->line('Preserved existing itinerary: '.$record['name']);

                    continue;
                }
                $stops = $record['stops'];
                unset($record['stops']);
                $itinerary = Itinerary::create($record);
                $itinerary->stops()->createMany($stops);
                $inserted++;
            }
        });

        $this->command?->info("Curated itineraries inserted: {$inserted}; existing itineraries preserved/skipped: {$skipped}.");
    }

    private function minute(string $time): int
    {
        if (! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
            throw new LogicException('Invalid itinerary time: '.$time);
        }

        return (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
    }

    private function displayTime(string $time): string
    {
        $hour = (int) substr($time, 0, 2);

        return ($hour % 12 ?: 12).substr($time, 2).' '.($hour < 12 ? 'AM' : 'PM');
    }

    private function prepare(array $plan): array
    {
        $start = $this->minute($plan['start']);
        $end = $this->minute($plan['end']);
        $expectedMinutes = match ($plan['duration']) {
            'Half Day' => 240,
            'Full Day' => 480,
            default => throw new LogicException('Unsupported curated duration.'),
        };
        if ($end - $start !== $expectedMinutes) {
            throw new LogicException('Duration mismatch: '.$plan['name']);
        }

        $previousEnd = $start;
        $stops = [];
        $seen = [];
        $lines = [];
        $startingLocation = null;
        $hasLunch = false;
        foreach ($plan['schedule'] as [$from, $to, $siteName, $activity]) {
            $fromMinute = $this->minute($from);
            $toMinute = $this->minute($to);
            if ($fromMinute !== $previousEnd || $toMinute <= $fromMinute || $toMinute > $end || trim($activity) === '') {
                throw new LogicException('Invalid or overlapping schedule: '.$plan['name']);
            }
            $previousEnd = $toMinute;
            $hasLunch = $hasLunch || str_contains(strtolower($activity), 'lunch');
            if ($siteName !== null) {
                $matches = HeritageSite::where('name', $siteName)->lockForUpdate()->get();
                if ($matches->count() !== 1 || $matches->first()->status !== 'active') {
                    throw new LogicException('Required destination must exist exactly once and be active: '.$siteName.'. No itineraries were inserted.');
                }
                $site = $matches->first();
                if (! str_contains(strtolower($site->address ?? ''), 'san fernando')
                    || ! str_contains(strtolower($site->address ?? ''), 'pampanga')) {
                    throw new LogicException('Destination address needs review: '.$siteName);
                }
                if (isset($seen[$site->id])) {
                    throw new LogicException('Duplicate destination: '.$plan['name']);
                }
                $seen[$site->id] = true;
                $startingLocation ??= $site->name.' — '.$site->address;
                $stops[] = ['heritage_site_id' => $site->id, 'sort_order' => count($stops)];
            }
            $lines[] = $this->displayTime($from).' – '.$this->displayTime($to)
                .' ('.($toMinute - $fromMinute).' min) | '.($siteName ?? 'Travel / break').': '.$activity;
        }

        $minimum = $plan['duration'] === 'Half Day' ? 3 : 5;
        $maximum = $plan['duration'] === 'Half Day' ? 5 : 7;
        if ($previousEnd !== $end || count($stops) < $minimum || count($stops) > $maximum
            || ($plan['duration'] === 'Full Day' && ! $hasLunch)) {
            throw new LogicException('Incomplete curated plan: '.$plan['name']);
        }

        $description = $plan['summary']."\n\nTheme: ".$plan['theme'].' | Duration: '.$plan['duration']
            .' ('.($expectedMinutes / 60).' hours)'
            ."\nSuggested schedule: ".$this->displayTime($plan['start']).' – '.$this->displayTime($plan['end'])
            ."\nStarting location: ".$startingLocation
            ."\n\nSuggested self-guided plan, not an officially operated tour. Times and travel buffers are estimates, not published opening hours. Confirm access before departure."
            ."\n\nSchedule\n".implode("\n", $lines)
            ."\n\nTravel notes\n".$plan['notes'];
        if (mb_strlen($description) > 10000) {
            throw new LogicException('Description exceeds the existing API limit.');
        }

        return [
            'source_key' => self::SOURCE_PREFIX.$plan['key'],
            'name' => $plan['name'], 'description' => $description,
            'status' => 'active', 'created_by' => null, 'stops' => $stops,
        ];
    }
}
