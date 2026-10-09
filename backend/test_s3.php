<?php
try {
    Illuminate\Support\Facades\Storage::disk('s3')->put('test.txt', 'AWS connection verified');
    echo 'Upload success: ' . (Illuminate\Support\Facades\Storage::disk('s3')->exists('test.txt') ? 'true' : 'false') . "\n";
    Illuminate\Support\Facades\Storage::disk('s3')->delete('test.txt');
} catch (\Exception $e) {
    echo 'Error: ' . $e->getMessage() . "\n";
    $prev = $e->getPrevious();
    if ($prev) {
        echo 'Previous: ' . $prev->getMessage() . "\n";
    }
}
