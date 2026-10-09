<?php

namespace App\Http\Controllers;

use App\Models\SiteImage;
use App\Models\HeritageSite;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class SiteImageController extends Controller
{
    public function index()
    {
        return SiteImage::whereHas('heritageSite', fn ($query) => $query->where('status', 'active'))
            ->orderBy('sort_order')->orderBy('id')->get();
    }

    public function adminIndex()
    {
        return SiteImage::orderBy('sort_order')->orderBy('id')->get();
    }

    public function show(SiteImage $siteImage)
    {
        abort_unless($siteImage->heritageSite?->status === 'active', 404);

        return $siteImage;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'heritage_site_id' => 'required|exists:heritage_sites,id',
            'image_path' => 'required_without:image|nullable|string|max:255',
            'image' => $this->imageRules(),
            'caption' => 'nullable|string|max:255',
            'is_cover' => 'sometimes|boolean',
            'sort_order' => 'sometimes|required|integer|min:0|max:2147483647',
        ]);

        $siteImage = $this->saveUpload($request, $data);

        return response()->json($siteImage, 201);
    }

    public function update(Request $request, SiteImage $siteImage)
    {
        $data = $request->validate([
            'heritage_site_id' => 'sometimes|required|integer|exists:heritage_sites,id',
            'image_path' => 'sometimes|required_without:image|nullable|string|max:255',
            'image' => $this->imageRules(),
            'caption' => 'nullable|string|max:255',
            'is_cover' => 'sometimes|boolean',
            'sort_order' => 'sometimes|required|integer|min:0|max:2147483647',
        ]);

        $siteImage = $this->saveUpload($request, $data, $siteImage);

        return response()->json($siteImage);
    }

    public function destroy(SiteImage $siteImage)
    {
        $path = DB::transaction(function () use ($siteImage) {
            $image = SiteImage::whereKey($siteImage->id)->lockForUpdate()->firstOrFail();
            $path = $image->image_path;
            $image->delete();
            return $path;
        });
        $this->deleteManagedFile($path);

        return response()->json([
            'message' => 'Image deleted successfully.',
        ]);
    }

    private function imageRules(): array
    {
        return ['bail', 'nullable', 'image', 'mimes:jpeg,jpg,png,webp,gif', 'max:5120',
            function ($attribute, $value, $fail) {
                if (@getimagesize($value->getRealPath()) === false) $fail('The image must contain a valid raster image.');
            }];
    }

    private function saveUpload(Request $request, array $data, ?SiteImage $image = null): SiteImage
    {
        $newPath = null;
        if ($request->hasFile('image')) {
            $newPath = $request->file('image')->store('heritage-sites', 's3');
            abort_unless($newPath, 500, 'Unable to store image.');
            $data['image_path'] = $newPath;
        }
        unset($data['image']);
        $previousPath = null;
        try {
            $saved = $this->saveImage($data, $image, $previousPath);
        } catch (\Throwable $error) {
            if ($newPath) $this->deleteManagedFile($newPath);
            throw $error;
        }
        // Only remove the old file after the database transaction has committed.
        if ($previousPath && $previousPath !== $saved->image_path) $this->deleteManagedFile($previousPath);
        return $saved;
    }

    private function deleteManagedFile(string $path): void
    {
        // Only flat files in our heritage upload directory are managed by this feature.
        $relative = preg_replace('#^/?storage/#', '', $path);
        if (!preg_match('#^heritage-sites/[A-Za-z0-9][A-Za-z0-9._-]*$#D', $relative)) return;
        $aliases = [$relative, 'storage/'.$relative, '/storage/'.$relative];
        if (SiteImage::whereIn('image_path', $aliases)->exists()) return;
        try {
            $deletedS3 = Storage::disk('s3')->delete($relative);
            $deletedPublic = Storage::disk('public')->delete($relative);
            if (!$deletedS3 && !$deletedPublic) {
                Log::warning('Heritage image file cleanup failed (not found on S3 or local).', ['path' => $relative]);
            }
        } catch (\Throwable $error) {
            Log::warning('Heritage image file cleanup failed.', ['path' => $relative]);
        }
    }

    private function saveImage(array $data, ?SiteImage $image, ?string &$previousPath): SiteImage
    {
        return DB::transaction(function () use ($data, $image, &$previousPath) {
            $targetSiteId = (int) ($data['heritage_site_id'] ?? $image->heritage_site_id);
            $sourceSiteId = $image?->heritage_site_id;
            // Lock parent rows even when a site has no images yet. This serializes cover changes.
            HeritageSite::whereIn('id', array_filter([$sourceSiteId, $targetSiteId]))
                ->orderBy('id')->lockForUpdate()->get();
            if ($image) {
                $image = SiteImage::whereKey($image->id)->lockForUpdate()->firstOrFail();
                abort_if($image->heritage_site_id !== $sourceSiteId, 409, 'Image association changed. Reload and try again.');
                $previousPath = $image->image_path;
            }
            if ((bool) ($data['is_cover'] ?? $image?->is_cover ?? false)) {
                $covers = SiteImage::where('heritage_site_id', $targetSiteId)->where('is_cover', true);
                if ($image) {
                    $covers->where('id', '!=', $image->id);
                }
                $covers->update(['is_cover' => false]);
            }
            if ($image) {
                $image->update($data);
                return $image->refresh();
            }
            return SiteImage::create($data)->refresh();
        }, 3);
    }
}
