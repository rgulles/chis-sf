<?php

namespace App\Http\Controllers;

use App\Models\SiteImage;
use Illuminate\Http\Request;

class SiteImageController extends Controller
{
    public function index()
    {
        return SiteImage::all();
    }

    public function show(SiteImage $siteImage)
    {
        return $siteImage;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'heritage_site_id' => 'required|exists:heritage_sites,id',
            'image_path' => 'required|string|max:255',
            'caption' => 'nullable|string|max:255',
        ]);

        $siteImage = SiteImage::create($data);

        return response()->json($siteImage, 201);
    }

    public function update(Request $request, SiteImage $siteImage)
    {
        $data = $request->validate([
            'heritage_site_id' => 'sometimes|required|integer|exists:heritage_sites,id',
            'image_path' => 'sometimes|string|max:255',
            'caption' => 'nullable|string|max:255',
        ]);

        $siteImage->update($data);

        return response()->json($siteImage);
    }

    public function destroy(SiteImage $siteImage)
    {
        $siteImage->delete();

        return response()->json([
            'message' => 'Image deleted successfully.',
        ]);
    }
}
