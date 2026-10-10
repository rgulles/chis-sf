<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HeritageVisitorInformationTest extends TestCase
{
    use RefreshDatabase;

    private const VALUES = [
        'opening_hours' => 'Weekdays by appointment',
        'entrance_fee' => 'Admission details available on request',
        'accessibility_notes' => 'Accessible ground floor only',
        'visit_notes' => 'Contact the office before visiting',
        'contact_information' => 'Tourism desk: visitor@example.test',
    ];

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
            throw new \LogicException('Visitor information tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function payload(): array
    {
        return ['name' => 'Site', 'description' => 'Overview', 'history' => 'History', 'address' => 'Address'];
    }

    private function adminHeaders(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);

        return ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
    }

    public function test_nullable_columns_and_creation_without_visitor_information(): void
    {
        $columns = collect(Schema::getColumns('heritage_sites'))->keyBy('name');
        foreach (array_keys(self::VALUES) as $field) {
            $this->assertTrue($columns[$field]['nullable']);
        }
        $response = $this->postJson('/api/heritage-sites', $this->payload(), $this->adminHeaders())->assertCreated();
        $site = HeritageSite::findOrFail($response->json('id'));
        $public = $this->getJson('/api/heritage-sites/'.$site->id)->assertOk();
        foreach (array_keys(self::VALUES) as $field) {
            $this->assertNull($site->$field);
            $public->assertJsonPath($field, null);
        }
    }

    public function test_visitor_values_round_trip_trim_preserve_and_clear(): void
    {
        $headers = $this->adminHeaders();
        $spaced = array_map(fn ($value) => '  '.$value.'  ', self::VALUES);
        $response = $this->postJson('/api/heritage-sites', $this->payload() + $spaced, $headers)->assertCreated();
        $id = $response->json('id');
        $public = $this->getJson('/api/heritage-sites/'.$id)->assertOk();
        $list = $this->getJson('/api/heritage-sites')->assertOk();
        $admin = $this->getJson('/api/admin/heritage-sites/'.$id, $headers)->assertOk();
        foreach (self::VALUES as $field => $value) {
            $public->assertJsonPath($field, $value);
            $list->assertJsonMissingPath('0.'.$field);
            $admin->assertJsonPath($field, $value);
        }
        $this->patchJson('/api/heritage-sites/'.$id, ['name' => 'Renamed'], $headers)->assertOk();
        $this->assertDatabaseHas('heritage_sites', ['id' => $id] + self::VALUES);
        $changed = array_map(fn ($value) => 'Updated: '.$value, self::VALUES);
        $this->putJson('/api/heritage-sites/'.$id, $changed, $headers)->assertOk();
        $this->assertDatabaseHas('heritage_sites', ['id' => $id] + $changed);
        $cleared = ['opening_hours' => '', 'entrance_fee' => '   ', 'accessibility_notes' => null,
            'visit_notes' => " \n ", 'contact_information' => ''];
        $this->patchJson('/api/heritage-sites/'.$id, $cleared, $headers)->assertOk();
        $site = HeritageSite::findOrFail($id);
        foreach (array_keys(self::VALUES) as $field) {
            $this->assertNull($site->$field);
        }
        $this->assertSame('Overview', $site->description);
        $this->assertSame('History', $site->history);
    }

    public function test_non_admin_cannot_create_or_modify_visitor_information(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $site = HeritageSite::create($this->payload() + self::VALUES + ['created_by' => $admin->id]);
        $traveler = User::factory()->create(['role' => 'traveler']);
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($traveler)];
        $this->postJson('/api/heritage-sites', $this->payload() + self::VALUES)->assertUnauthorized();
        $this->patchJson('/api/heritage-sites/'.$site->id, ['opening_hours' => 'Changed'])->assertUnauthorized();
        $this->postJson('/api/heritage-sites', $this->payload() + self::VALUES, $headers)->assertForbidden();
        $this->patchJson('/api/heritage-sites/'.$site->id, array_fill_keys(array_keys(self::VALUES), 'Changed'), $headers)->assertForbidden();
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id] + self::VALUES);
    }

    public function test_visitor_fields_reject_non_strings_and_excessive_lengths(): void
    {
        $headers = $this->adminHeaders();
        $response = $this->postJson('/api/heritage-sites', $this->payload(), $headers)->assertCreated();
        $limits = ['opening_hours' => 1000, 'entrance_fee' => 1000, 'accessibility_notes' => 3000,
            'visit_notes' => 3000, 'contact_information' => 2000];
        foreach ($limits as $field => $limit) {
            foreach ([['invalid'], str_repeat('x', $limit + 1)] as $invalid) {
                $this->postJson('/api/heritage-sites', $this->payload() + [$field => $invalid], $headers)
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
                $this->patchJson('/api/heritage-sites/'.$response->json('id'), [$field => $invalid], $headers)
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        $this->assertDatabaseCount('heritage_sites', 1);
    }
}
