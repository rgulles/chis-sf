<?php

namespace App\Console\Commands;

use App\Services\OfficialHeritageReconciler;
use Illuminate\Console\Command;
use Throwable;

class ReconcileOfficialHeritage extends Command
{
    protected $signature = 'heritage:reconcile-official {--dry-run} {--apply} {--created-by=} {--reviewed-fingerprint=}';

    protected $description = 'Preview archival and unambiguous name aliases; explicit reviewed apply only, never delete records';

    public function handle(OfficialHeritageReconciler $reconciler): int
    {
        if ($this->option('apply') && $this->option('dry-run')) {
            $this->error('Choose --dry-run or --apply, not both.');

            return self::FAILURE;
        }
        $admin = $this->option('created-by');
        if ($admin !== null && (! ctype_digit((string) $admin) || (int) $admin < 1)) {
            $this->error('--created-by must be a positive admin ID.');

            return self::FAILURE;
        }
        try {
            $report = $reconciler->reconcile((bool) $this->option('apply'), $admin === null ? null : (int) $admin, $this->option('reviewed-fingerprint'));
        } catch (Throwable $failure) {
            $this->error('No changes committed: '.$failure->getMessage());

            return self::FAILURE;
        }
        $this->info($report['mode']);
        $this->table(['DB ID', 'Current Name', 'Field', 'From', 'To'], array_map(fn ($change) => [$change['id'], $change['current_name'], $change['field'], $change['from'], $change['to']], $report['changes']));
        $this->line($report['limitations']);
        $this->line('Reviewed fingerprint: '.$report['fingerprint']);
        if (! $this->option('apply')) {
            $this->line('After manual review only: php artisan heritage:reconcile-official --apply --created-by=ADMIN_ID --reviewed-fingerprint='.$report['fingerprint']);
        }

        return self::SUCCESS;
    }
}
