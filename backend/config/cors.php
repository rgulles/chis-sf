<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    // Set the exact Vercel origin in Railway; keep the local Vite default.
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    'exposed_headers' => [],
    'max_age' => 0,
    // API authentication uses JWT Bearer tokens, not cross-origin session cookies.
    'supports_credentials' => false,
];
