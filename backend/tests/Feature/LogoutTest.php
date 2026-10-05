<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $app = parent::createApplication();
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.url', null);
        $app['config']->set('database.connections.sqlite.database', ':memory:');
        $app['config']->set('database.connections.sqlite.transaction_mode', 'DEFERRED');

        return $app;
    }

    protected function migrateDatabases()
    {
        if (config('database.default') !== 'sqlite'
            || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('Logout tests require in-memory SQLite.');
        }

        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    public static function roles(): array
    {
        return [['admin'], ['traveler']];
    }

    #[DataProvider('roles')]
    public function test_logout_revokes_only_the_current_token(string $role): void
    {
        $user = User::factory()->create(['role' => $role]);
        $current = $user->createToken('current-device');
        $other = $user->createToken('other-device');
        $headers = ['Authorization' => 'Bearer '.$current->plainTextToken];

        $this->getJson('/api/auth/me', $headers)->assertOk()->assertJsonPath('user.role', $role);
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/logout', [], $headers)
            ->assertOk()->assertExactJson(['message' => 'Logged out successfully']);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $current->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $other->accessToken->id]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/auth/me', $headers)->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/auth/me', ['Authorization' => 'Bearer '.$other->plainTextToken])->assertOk();
    }

    public function test_invalid_token_logout_is_rejected_without_deleting_other_tokens(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('other-device');
        $this->postJson('/api/auth/logout', [], ['Authorization' => 'Bearer invalid-token'])
            ->assertUnauthorized();
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token->accessToken->id]);
    }
}
