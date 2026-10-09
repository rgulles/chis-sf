<?php

namespace App\Services;

use App\Models\HeritageSite;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OfficialHeritageReconciler
{
    public function reconcile(bool $apply = false, ?int $adminId = null, ?string $reviewedFingerprint = null): array
    {
        return DB::transaction(function () use ($apply, $adminId, $reviewedFingerprint) {
            $audit = app(OfficialHeritageAudit::class);
            $sites = HeritageSite::orderBy('id')->when($apply, fn ($query) => $query->lockForUpdate())->get();
            $rows = $audit->audit($sites);
            $changes = [];
            foreach ($rows as $row) {
                $site = $sites->firstWhere('id', $row['id']);
                if (! $site) {
                    continue;
                }
                if ($row['status'] === 'NOT_IN_OFFICIAL_SOURCE' && $site->status !== 'archived') {
                    $changes[] = ['id' => $site->id, 'current_name' => $site->name, 'field' => 'status', 'from' => $site->status, 'to' => 'archived'];
                } elseif ($row['status'] === 'OFFICIAL_ALIAS') {
                    $changes[] = ['id' => $site->id, 'current_name' => $site->name, 'field' => 'name', 'from' => $site->name, 'to' => $row['official_match']];
                }
            }
            $fingerprint = hash('sha256', json_encode([$audit->index(), $sites->map->only(['id', 'name', 'status', 'updated_at'])->toArray(), $changes]));
            if ($apply) {
                if (! $adminId || ! User::whereKey($adminId)->where('role', 'admin')->exists()) {
                    throw new InvalidArgumentException('Apply requires --created-by with an existing admin ID.');
                }
                if (! $reviewedFingerprint || ! hash_equals($fingerprint, $reviewedFingerprint)) {
                    throw new InvalidArgumentException('Run dry-run and review its fingerprint. Apply requires the same --reviewed-fingerprint; catalogue changes invalidate it.');
                }
                foreach ($changes as $change) {
                    $sites->firstWhere('id', $change['id'])->update([$change['field'] => $change['to']]);
                }
            }

            return ['mode' => $apply ? 'APPLY' : 'DRY RUN', 'fingerprint' => $fingerprint, 'changes' => $changes,
                'limitations' => 'Name-list reconciliation only. No detail, coordinate, duplicate merge or missing-site creation. Replacement PDF detail review remains pending.'];
        });
    }
}
