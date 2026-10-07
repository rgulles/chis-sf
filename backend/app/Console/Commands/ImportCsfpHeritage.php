<?php

namespace App\Console\Commands;

use App\Services\CsfpHeritageImporter;
use Illuminate\Console\Command;
use Throwable;

class ImportCsfpHeritage extends Command
{
    protected $signature = 'heritage:import-csfp
        {--dry-run : Preview only (also the default)}
        {--apply : Explicitly create missing sites and fill empty fields}
        {--created-by= : Existing admin user ID required for --apply}
        {--source= : Reviewed backend JSON source; defaults to database/data/csfp_heritage_master.json}';

    protected $description = 'Safely preview/import the owner-supplied City Tourism heritage master list';

    public function handle(CsfpHeritageImporter $importer): int
    {
        if ($this->option('apply') && $this->option('dry-run')) {
            $this->error('Choose --dry-run or --apply, not both.');

            return self::FAILURE;
        }
        $creator = $this->option('created-by');
        if ($creator !== null && (! ctype_digit((string) $creator) || (int) $creator < 1)) {
            $this->error('--created-by must be a positive database user ID.');

            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        try {
            $source = $importer->readSource($this->option('source') ?: database_path('data/csfp_heritage_master.json'));
            // Serialize command runs on this installation. Deployments sharing a database
            // across multiple hosts must coordinate imports; there is no schema-level key.
            $lock = fopen(storage_path('framework/csfp-heritage-import.lock'), 'c');
            if ($lock === false || ! flock($lock, LOCK_EX | LOCK_NB)) {
                $this->error('Another import is running on this installation. Retry after it finishes.');

                return self::FAILURE;
            }
            try {
                $report = $importer->import($source, $apply, $creator === null ? null : (int) $creator);
            } finally {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        } catch (Throwable $exception) {
            $this->error('Import failed; no changes committed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info($apply ? 'APPLY: only missing records and empty fields are written.' : 'DRY RUN: no database records created or updated.');
        $this->table(['Source key', 'Name', 'DB ID', 'Result', 'Fields / review notes'], array_map(fn ($row) => [
            $row['key'], $row['name'], $row['id'] ?? '-', $row['action'],
            implode(', ', $row['fields']).($row['reason'] ? ' '.$row['reason'] : ''),
        ], $report));
        foreach (array_count_values(array_column($report, 'action')) as $action => $count) {
            $this->line($action.': '.$count);
        }
        $this->line('Existing non-empty values, status, creator, images and timelines are preserved. Review skipped/ambiguous rows before applying.');
        if (! $apply) {
            $this->line('After review: php artisan heritage:import-csfp --apply --created-by=<admin-id>');
        }

        return self::SUCCESS;
    }
}
