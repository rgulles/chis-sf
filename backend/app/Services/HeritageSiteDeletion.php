<?php

namespace App\Services;

use App\Models\AdminActivity;
use App\Models\Event;
use App\Models\HeritageContributionImage;
use App\Models\HeritageSite;
use App\Models\Itinerary;
use App\Models\ItineraryStop;
use App\Models\SiteImage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class HeritageSiteDeletion
{
    public function delete(int $id, array $intent = []): array
    {
        return DB::transaction(function () use ($id, $intent) {
            // Re-read under lock: route binding and the Admin screen may both be stale.
            $site = HeritageSite::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_if(isset($intent['expected_status']) && $intent['expected_status'] !== $site->status,
                409, 'Site status changed. Reload and try again.');
            abort_if(($intent['permanent'] ?? false) && $site->status !== 'archived',
                409, 'Only archived heritage sites can be permanently deleted.');

            if ($site->status !== 'archived') {
                $site->update(['status' => 'archived']);
                AdminActivity::log('archived', 'HeritageSite', $site->name);

                return ['action' => 'archived', 'message' => 'Heritage site archived successfully.'];
            }

            $paths = $site->images()->pluck('image_path')->merge(
                HeritageContributionImage::whereIn('heritage_contribution_id', $site->contributions()->select('id'))
                    ->pluck('image_path')
            )->unique()->all();

            $itineraryIds = ItineraryStop::where('heritage_site_id', $id)->pluck('itinerary_id');
            $itineraries = Itinerary::whereIn('id', $itineraryIds)->orderBy('id')->lockForUpdate()->get();
            ItineraryStop::where('heritage_site_id', $id)->delete();
            foreach ($itineraries as $itinerary) {
                foreach ($itinerary->stops()->lockForUpdate()->get() as $order => $stop) {
                    $stop->update(['sort_order' => $order]);
                }
            }

            // These foreign keys restrict deletion. The remaining children cascade in the schema.
            $site->visits()->delete();
            $site->checkinConfig()->delete();
            $site->delete();
            AdminActivity::log('deleted', 'HeritageSite', $site->name);

            // Never remove files if the database transaction rolls back.
            DB::afterCommit(fn () => $this->cleanupFiles($paths));

            return ['action' => 'deleted', 'message' => $site->name.' was permanently deleted.'];
        }, 3);
    }

    private function managedPath(string $path): ?string
    {
        $path = preg_replace('#^/?storage/#', '', $path);

        return preg_match('#^(?:heritage-sites/[A-Za-z0-9][A-Za-z0-9._-]*|visitor-contributions/[A-Za-z0-9]+\.(?:jpg|jpeg|png|webp))$#D', $path)
            ? $path : null;
    }

    private function cleanupFiles(array $paths): void
    {
        foreach ($paths as $storedPath) {
            $path = $this->managedPath($storedPath);
            if ($path === null) {
                continue;
            } // External URLs and unmanaged assets are not owned uploads.
            try {
                // Contributions, official site photos and event images can share an object.
                if ($this->isReferenced($path)) {
                    continue;
                }
            } catch (\Throwable $error) {
                Log::warning('Heritage site file ownership check failed; file retained.', ['path' => $path]);

                continue;
            }
            foreach (['s3', 'public'] as $disk) {
                try {
                    if (! Storage::disk($disk)->delete($path)) {
                        Log::warning('Heritage site file cleanup failed; retry required.', ['disk' => $disk, 'path' => $path]);
                    }
                } catch (\Throwable $error) {
                    // The committed deletion remains valid; log the object for operational retry.
                    Log::warning('Heritage site file cleanup failed; retry required.', ['disk' => $disk, 'path' => $path]);
                }
            }
        }
    }

    private function isReferenced(string $path): bool
    {
        foreach ([SiteImage::class, HeritageContributionImage::class, Event::class] as $model) {
            foreach ($model::whereNotNull('image_path')->select('image_path')->cursor() as $image) {
                $reference = $image->image_path;
                if (preg_match('#^https?://#i', $reference)) {
                    // Preserve even signed/CDN URLs and unknown hosts if they could reference this key.
                    $urlPath = rawurldecode(parse_url($reference, PHP_URL_PATH) ?? '');
                    if (str_ends_with($urlPath, '/'.$path)) {
                        return true;
                    }
                } elseif ($this->managedPath($reference) === $path) {
                    return true;
                }
            }
        }

        return false;
    }
}
