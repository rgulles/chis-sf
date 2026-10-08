<?php

namespace App\Http\Controllers;

use App\Models\HeritageContribution;
use App\Models\HeritageContributionImage;
use App\Models\HeritageSite;
use App\Models\HeritageVisit;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class HeritageContributionController extends Controller
{
    // Explicit allowlist: never serialize a visitor, visit or moderation model publicly.
    private function publicData(HeritageContribution $contribution): array
    {
        return [
            'id' => $contribution->id,
            'caption' => $contribution->caption,
            'created_at' => $contribution->created_at?->toISOString(),
            'visitor_name' => $contribution->user?->name ?? 'Visitor',
            'images' => $contribution->images->map(fn ($image) => Storage::disk('public')->url($image->image_path))->values(),
        ];
    }

    public function index(HeritageSite $heritageSite)
    {
        abort_unless($heritageSite->status === 'active', 404);

        return $heritageSite->contributions()->where('status', 'approved')->with(['user:id,name', 'images'])
            ->orderByDesc('created_at')->orderByDesc('id')->get()->map(fn ($item) => $this->publicData($item));
    }

    private function verified(int $userId, int $siteId): bool
    {
        return HeritageVisit::where('user_id', $userId)->where('heritage_site_id', $siteId)->whereNotNull('verified_at')->exists();
    }

    public function mine(Request $request, HeritageSite $heritageSite)
    {
        $item = $heritageSite->contributions()->where('user_id', $request->user()->id)->first();
        $verified = $this->verified($request->user()->id, $heritageSite->id);

        return ['can_submit' => $heritageSite->status === 'active' && $verified
            && (! $item || $item->status === 'rejected'),
            'verified' => $verified,
            'active' => $heritageSite->status === 'active',
            'contribution' => $item?->only(['id', 'status'])];
    }

    public function store(Request $request, HeritageSite $heritageSite)
    {
        $data = $request->validate([
            'caption' => ['nullable', 'string', 'max:500', function ($attribute, $value, $fail) {
                if ($value !== strip_tags($value)) {
                    $fail('The caption must be plain text without HTML.');
                }
            }],
            'images' => 'required|array|min:1|max:3',
            'images.*' => ['bail', 'required', 'image', 'mimes:jpeg,jpg,png,webp',
                'mimetypes:image/jpeg,image/png,image/webp', 'extensions:jpeg,jpg,png,webp', 'max:5120',
                function ($attribute, $value, $fail) {
                    if (@getimagesize($value->getRealPath()) === false) {
                        $fail('Each photo must contain a valid JPEG, PNG or WebP image.');
                    }
                }],
        ]);
        $newPaths = [];
        $oldPaths = [];
        try {
            $item = DB::transaction(function () use ($request, $heritageSite, $data, &$newPaths, &$oldPaths) {
                // Same lock order as visit verification. The unique index also prevents concurrent duplicates.
                User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $site = HeritageSite::whereKey($heritageSite->id)->lockForUpdate()->firstOrFail();
                abort_unless($site->status === 'active', 409, 'This heritage site is archived and cannot accept contributions.');
                abort_unless($this->verified($request->user()->id, $site->id), 403, 'Verify your visit before sharing an experience.');
                $item = $site->contributions()->where('user_id', $request->user()->id)->lockForUpdate()->first();
                abort_if($item && $item->status !== 'rejected', 409, 'A contribution already exists for this heritage site.');
                if ($item) {
                    $oldPaths = $item->images()->pluck('image_path')->all();
                    $item->images()->delete();
                    $item->update(['caption' => $data['caption'] ?? null, 'status' => 'pending', 'approved_by' => null,
                        'approved_at' => null, 'rejected_at' => null]);
                } else {
                    $item = HeritageContribution::create(['user_id' => $request->user()->id, 'heritage_site_id' => $site->id,
                        'caption' => $data['caption'] ?? null, 'status' => 'pending']);
                }
                foreach (array_values($request->file('images')) as $order => $file) {
                    $path = $file->store('visitor-contributions', 'public');
                    abort_unless($path, 500);
                    $newPaths[] = $path;
                    $item->images()->create(['image_path' => $path, 'sort_order' => $order]);
                }

                return $item;
            });
        } catch (\Throwable $error) {
            foreach ($newPaths as $path) {
                $this->deleteManagedFile($path);
            }
            throw $error;
        }
        foreach ($oldPaths as $path) {
            $this->deleteManagedFile($path);
        }

        return response()->json($item->only(['id', 'status']), 201);
    }

    public function adminIndex(Request $request)
    {
        $data = $request->validate(['status' => 'sometimes|in:pending,approved,rejected']);

        return HeritageContribution::where('status', $data['status'] ?? 'pending')->with(['user:id,name', 'images', 'heritageSite:id,name,status'])
            ->orderByDesc('created_at')->orderByDesc('id')->get()->map(fn ($item) => [...$this->publicData($item),
                'status' => $item->status, 'heritage_site' => $item->heritageSite?->only(['id', 'name', 'status'])]);
    }

    public function moderate(Request $request, HeritageContribution $contribution)
    {
        $data = $request->validate(['status' => 'required|in:approved,rejected']);
        $item = DB::transaction(function () use ($request, $contribution, $data) {
            $site = HeritageSite::whereKey($contribution->heritage_site_id)->lockForUpdate()->firstOrFail();
            $item = HeritageContribution::whereKey($contribution->id)->lockForUpdate()->firstOrFail();
            if ($data['status'] === 'approved') {
                abort_unless($site->status === 'active' && $item->images()->count() >= 1, 409);
                $item->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now(), 'rejected_at' => null]);
            } else {
                $item->update(['status' => 'rejected', 'approved_by' => null, 'approved_at' => null, 'rejected_at' => now()]);
            }

            return $item;
        });

        return $item->only(['id', 'status']);
    }

    public function destroy(HeritageContribution $contribution)
    {
        $paths = DB::transaction(function () use ($contribution) {
            $item = HeritageContribution::whereKey($contribution->id)->lockForUpdate()->firstOrFail();
            $paths = $item->images()->pluck('image_path')->all();
            $item->delete();

            return $paths;
        });
        foreach ($paths as $path) {
            $this->deleteManagedFile($path);
        }

        return response()->noContent();
    }

    private function deleteManagedFile(string $path): void
    {
        // Only flat, generated contribution filenames; never paths, URLs or official images.
        if (! preg_match('~\Avisitor-contributions/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|webp)\z~', $path)) {
            return;
        }
        $references = [$path, '/storage/'.$path, 'storage/'.$path, Storage::disk('public')->url($path)];
        if (HeritageContributionImage::whereIn('image_path', $references)->exists() || SiteImage::whereIn('image_path', $references)->exists()) {
            return;
        }
        try {
            if (! Storage::disk('public')->delete($path)) {
                Log::warning('Unable to clean up a contribution image.');
            }
        } catch (\Throwable $error) {
            report($error);
        }
    }
}
