<?php

namespace App\Console\Commands;

use App\Models\HeritageSite;
use App\Models\ItineraryStop;
use App\Services\OfficialHeritageAudit;
use Illuminate\Console\Command;

class AuditOfficialHeritage extends Command
{
    protected $signature = 'heritage:audit-official {--json : Emit machine-readable dry-run report}';

    protected $description = 'Read-only official name audit of every heritage DB row and import metadata; never writes or deletes records';

    public function handle(OfficialHeritageAudit $audit): int
    {
        $sites = HeritageSite::orderBy('id')->get();
        $master = json_decode(file_get_contents(database_path('data/csfp_heritage_master.json')), true, 512, JSON_THROW_ON_ERROR);
        $rows = $audit->audit($sites);
        $report = [
            'mode' => 'DRY RUN — no database writes', 'source' => $audit->index()['source'],
            'replacement_pdf_present' => is_file(base_path('../docs/CHIS-SF(1).pdf')),
            'database_count' => $sites->count(), 'metadata_count' => count($master['sites']),
            'statuses' => array_count_values(array_column($rows, 'status')), 'database' => $rows,
            'metadata' => $audit->audit($master['sites']),
            'itinerary_stops' => ItineraryStop::orderBy('id')->get(['id', 'itinerary_id', 'heritage_site_id'])->toArray(),
            'detail_review' => $sites->map(fn ($site) => ['id' => $site->id, 'name' => $site->name, 'status' => $site->status,
                'fields_requiring_pdf_comparison' => array_filter($site->only(['address', 'description', 'history', 'year_built']), fn ($value) => $value !== null && $value !== ''),
                'visitor_fields_preserved_for_admin_review' => array_filter($site->only(['opening_hours', 'entrance_fee', 'accessibility_notes', 'visit_notes', 'contact_information']), fn ($value) => $value !== null && $value !== ''),
                'coordinates_preserved_not_pdf_verified' => $site->only(['latitude', 'longitude'])])->toArray(),
        ];
        if ($this->option('json')) {
            $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        } else {
            $this->warn($report['source']);
            $this->info('DRY RUN: no database writes. Detail reconciliation requires the replacement PDF.');
            $this->table(['DB ID', 'Current Name', 'Official Match', 'Status', 'Recommended Action'], array_map(fn ($row) => [$row['id'] ?? '-', $row['name'], $row['official_match'] ?? '-', $row['status'], $row['recommended_action']], $rows));
            foreach ($report['statuses'] as $status => $count) {
                $this->line($status.': '.$count);
            }
        }

        return self::SUCCESS;
    }
}
