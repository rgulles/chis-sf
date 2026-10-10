<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|max:128',
            'role' => 'prohibited',
        ]);
        $user = User::create([...$data, 'role' => 'traveler']);

        return $this->tokenResponse(auth('api')->login($user), $user, 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password ?? '')) {
            return response()->json([
                'error' => 'Invalid credentials',
            ], 401);
        }

        $token = auth('api')->login($user);

        return $this->tokenResponse($token, $user);
    }

    public function google(Request $request)
    {
        $request->validate([
            'credential' => 'required|string',
            'role' => 'prohibited',
        ]);

        $credential = $request->input('credential');

        $response = Http::withoutVerifying()->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $credential,
        ]);

        if (! $response->successful()) {
            return response()->json([
                'error' => 'Invalid or expired Google credential.',
            ], 401);
        }

        $payload = $response->json();

        $expectedClientId = config('services.google.client_id');
        $aud = $payload['aud'] ?? null;

        if ($expectedClientId && $aud !== $expectedClientId) {
            return response()->json([
                'error' => 'Google credential client ID mismatch.',
            ], 401);
        }

        $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if (! $emailVerified || empty($payload['sub']) || empty($payload['email'])) {
            return response()->json([
                'error' => 'Google account email is unverified or invalid.',
            ], 401);
        }

        $googleId = (string) $payload['sub'];
        $email = strtolower(trim($payload['email']));
        $name = trim($payload['name'] ?? 'Google Traveler');
        $avatar = $payload['picture'] ?? null;

        $user = User::where('google_id', $googleId)->first();

        if (! $user) {
            $user = User::where('email', $email)->first();

            if ($user) {
                // Safely link existing account
                $user->google_id = $googleId;
                if (empty($user->avatar) && $avatar) {
                    $user->avatar = $avatar;
                }
                $user->save();
            } else {
                // New user registration - strictly force role = traveler
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'google_id' => $googleId,
                    'avatar' => $avatar,
                    'role' => 'traveler',
                    'password' => null,
                ]);
            }
        } else {
            if ($avatar && $user->avatar !== $avatar) {
                $user->avatar = $avatar;
                $user->save();
            }
        }

        $token = auth('api')->login($user);

        return $this->tokenResponse($token, $user);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function logout(Request $request)
    {
        // Propagate blacklist storage failures instead of reporting false revocation.
        auth('api')->invalidate();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    private function tokenResponse(string $token, User $user, int $status = 200)
    {
        return response()->json([
            'user' => $user,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
        ], $status)->header('Cache-Control', 'no-store');
    }

    public function refresh(Request $request)
    {
        $guard = auth('api');
        $token = $guard->refresh();
        $user = $guard->setToken($token)->user();
        if (! $user) {
            $guard->invalidate();

            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $this->tokenResponse($token, $user);
    }

    public function travelers(Request $request)
    {
        $travelers = User::where('role', 'traveler')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'role', 'google_id', 'avatar', 'created_at']);

        $formatted = $travelers->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'login_method' => $user->google_id ? 'Google' : 'Email/Password',
                'avatar' => $user->avatar,
                'created_at' => $user->created_at ? $user->created_at->toIso8601String() : null,
            ];
        });

        return response()->json($formatted);
    }
}
