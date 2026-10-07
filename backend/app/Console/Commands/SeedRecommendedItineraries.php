<?php

namespace App\Console\Commands;

use App\Models\HeritageSite;
use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class SeedRecommendedItineraries extends Command
{
    protected $signature = 'itinerary:seed-recommended {--dry-run} {--apply} {--created-by=}';

    protected $description = 'Preview/create curated routes referencing existing heritage records, preserving Admin edits';

    public function handle(): int
    {
        if ($this->option('apply') && $this->option('dry-run')) {
            $this->error('Choose --dry-run or --apply, not both.');

            return self::FAILURE;
        }
        $apply = (bool) $this->option('apply');
        $creator = $this->option('created-by');
        if ($apply && (! ctype_digit((string) $creator) || ! User::whereKey($creator)->where('role', 'admin')->exists())) {
            $this->error('--apply requires --created-by=<existing-admin-id>.');

            return self::FAILURE;
        }
        $normalize = fn ($name) => mb_strtolower(preg_replace('/\s+/u', ' ', trim($name)));
        try {
            $routes = json_decode(file_get_contents(database_path('data/recommended_itineraries.json')), true, 512, JSON_THROW_ON_ERROR)['routes'];
            $report = DB::transaction(function () use ($routes, $apply, $creator, $normalize) {
                $sites = HeritageSite::where('status', 'active')->get();
                $report = [];
                foreach ($routes as $route) {
                    $existing = Itinerary::where('source_key', $route['key'])->orWhereRaw('LOWER(name) = ?', [$normalize($route['name'])])->get();
                    if ($existing->isNotEmpty()) {
                        $report[] = [$route['name'], $existing->count() === 1 ? 'already exists; preserved' : 'ambiguous itinerary; skipped', ''];
                        continue;
                    }
                    $ids = []; $notes = [];
                    foreach ($route['stops'] as $names) {
                        $matches = $sites->filter(fn ($site) => in_array($normalize($site->name), array_map($normalize, $names), true));
                        if ($matches->count() !== 1) {
                            $notes[] = ($matches->isEmpty() ? 'Missing: ' : 'Ambiguous: ').$names[0];
                            continue;
                        }
                        $ids[] = $matches->first()->id;
                    }
                    $ids = array_values(array_unique($ids));
                    if (! $ids) {
                        $report[] = [$route['name'], 'skipped; no matching active sites', implode('; ', $notes)];
                        continue;
                    }
                    if ($apply) {
                        $itinerary = Itinerary::create(['source_key' => $route['key'], 'name' => $route['name'], 'description' => $route['description'], 'status' => 'active', 'created_by' => (int) $creator]);
                        $itinerary->stops()->createMany(array_map(fn ($id, $order) => ['heritage_site_id' => $id, 'sort_order' => $order], $ids, array_keys($ids)));
                    }
                    $report[] = [$route['name'], ($apply ? 'created' : 'would create').' ('.count($ids).' stops)', implode('; ', $notes)];
                }

                return $report;
            });
        } catch (Throwable $error) {
            $this->error('No changes committed: '.$error->getMessage());

            return self::FAILURE;
        }
        $this->info($apply ? 'APPLY: missing itineraries created; existing itineraries untouched.' : 'DRY RUN: no database records created or updated.');
        $this->table(['Itinerary', 'Result', 'Review notes'], $report);

        return self::SUCCESS;
    }
}
