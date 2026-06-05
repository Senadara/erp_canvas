<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadService
{
    public function uploadImage(UploadedFile $file, string $path = 'uploads'): string
    {
        $extension = $file->getClientOriginalExtension();
        $filename = Str::ulid() . '.' . $extension;
        
        $storedPath = $file->storeAs($path, $filename, 'public');
        
        return '/storage/' . $storedPath;
    }
}
