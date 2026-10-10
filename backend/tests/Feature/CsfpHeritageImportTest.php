<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\User;
use App\Services\CsfpHeritageImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class CsfpHeritageImportTest extends TestCase
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
            throw new \LogicException('Import tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function importer(): CsfpHeritageImporter
    {
        return app(CsfpHeritageImporter::class);
    }

    private function master(): array
    {
        return $this->importer()->readSource(database_path('data/csfp_heritage_master.json'));
    }

    private function fixture(array $values = []): array
    {
        // Synthetic text is test-only; the actual master contains no invented history.
        $entry = array_replace($this->master()['sites'][0], [
            'description' => 'Source fixture overview', 'history' => 'Source fixture history',
            'opening_hours' => 'Source fixture hours', 'entrance_fee' => 'Source fixture fee',
            'accessibility_notes' => 'Source fixture accessibility', 'visit_notes' => 'Source fixture notes',
            'contact_information' => 'Source fixture contact', 'year_built' => 'Source fixture year',
        ], $values);

        return ['version' => 1, 'sites' => [$entry], 'excluded_entries' => []];
    }

    private function existing(array $values = []): HeritageSite
    {
        $admin = User::factory()->create(['role' => 'admin']);

        return HeritageSite::create(array_replace([
            'created_by' => $admin->id, 'name' => 'Heroes Hall and Heroes Park',
            'description' => '', 'history' => '', 'address' => '', 'status' => 'active',
        ], $values))->refresh();
    }

    public function test_explicit_and_default_dry_runs_create_no_records_or_users(): void
    {
        foreach ([['--dry-run' => true], []] as $options) {
            $this->artisan('heritage:import-csfp', $options)
                ->expectsOutputToContain('DRY RUN: no database records created or updated.')
                ->expectsOutputToContain('would create: 34')
                ->expectsOutputToContain('skipped: 5')->assertExitCode(0);
            $this->assertDatabaseCount('heritage_sites', 0);
            $this->assertDatabaseCount('users', 0);
        }
    }

    public function test_apply_requires_a_real_admin_and_rejects_conflicting_flags(): void
    {
        $traveler = User::factory()->create(['role' => 'traveler']);
        foreach ([[], ['--created-by' => $traveler->id], ['--created-by' => 99999]] as $options) {
            $this->artisan('heritage:import-csfp', ['--apply' => true] + $options)
                ->expectsOutputToContain('existing admin user ID')->assertExitCode(1);
        }
        $this->artisan('heritage:import-csfp', ['--apply' => true, '--dry-run' => true])->assertExitCode(1);
        $this->assertDatabaseCount('heritage_sites', 0);
    }

    public function test_repeated_command_import_is_idempotent_and_excludes_content_and_review_row(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $options = ['--apply' => true, '--created-by' => $admin->id];
        $this->artisan('heritage:import-csfp', $options)->expectsOutputToContain('created: 34')->assertExitCode(0);
        $ids = HeritageSite::orderBy('id')->pluck('id', 'name')->all();
        $this->artisan('heritage:import-csfp', $options)->expectsOutputToContain('already exists: 34')->assertExitCode(0);
        $this->assertSame($ids, HeritageSite::orderBy('id')->pluck('id', 'name')->all());
        $this->assertDatabaseCount('heritage_sites', 34);
        foreach (['National Heroes', 'Local Heroes', 'Kalesa Tour', 'Lantern Making', 'Baron-Cuyugan House', 'Vivencio Cuyugan Monument'] as $name) {
            $this->assertDatabaseMissing('heritage_sites', ['name' => $name]);
        }
        $this->getJson('/api/heritage-sites')->assertOk()->assertJsonCount(34);
        $this->assertSame(0, HeritageSite::where('status', '!=', 'active')->count());
        $this->assertSame(0, HeritageSite::whereNotIn('category', HeritageSite::CATEGORIES)->count());
        foreach ($this->master()['sites'] as $entry) {
            if ($entry['review_required'] ?? false) {
                continue;
            }
            $this->assertTrue(filled($entry['description']) || filled($entry['history']), $entry['name'].' must have PDF-backed narrative content.');
            $site = HeritageSite::where('name', $entry['name'])->firstOrFail();
            $this->assertSame(trim($entry['description'] ?? ''), $site->description, $entry['name'].' description');
            $this->assertSame(trim($entry['history'] ?? ''), $site->history, $entry['name'].' history');
        }
    }

    public function test_pdf_narratives_fill_empty_fields_and_preserve_nonempty_admin_values(): void
    {
        $source = $this->master();
        $source['sites'] = array_values(array_filter($source['sites'], fn ($entry) => in_array($entry['source_number'], [1, 4], true)));
        $source['excluded_entries'] = [];
        $this->assertCount(2, $source['sites']);
        foreach ($source['sites'] as $entry) {
            $this->assertNotEmpty($entry['description'], $entry['name'].' PDF overview');
            $this->assertNotEmpty($entry['history'], $entry['name'].' PDF history');
        }

        $heroes = $this->existing(['description' => '  ', 'history' => 'Admin-edited Heroes history']);
        $capitol = $this->existing(['name' => 'Pampanga Provincial Capitol',
            'description' => 'Admin-edited Capitol overview', 'history' => '']);
        $before = HeritageSite::orderBy('id')->get()->toArray();
        $preview = $this->importer()->import($source);
        $this->assertSame(['would update empty fields', 'would update empty fields'], array_column($preview, 'action'));
        $this->assertContains('description', $preview[0]['fields']);
        $this->assertNotContains('history', $preview[0]['fields']);
        $this->assertContains('history', $preview[1]['fields']);
        $this->assertNotContains('description', $preview[1]['fields']);
        $this->assertSame($before, HeritageSite::orderBy('id')->get()->toArray());

        $this->importer()->import($source, true, $heroes->created_by);
        $this->assertDatabaseCount('heritage_sites', 2);
        $this->assertSame($source['sites'][0]['description'], $heroes->fresh()->description);
        $this->assertSame('Admin-edited Heroes history', $heroes->fresh()->history);
        $this->assertSame('Admin-edited Capitol overview', $capitol->fresh()->description);
        $this->assertSame($source['sites'][1]['history'], $capitol->fresh()->history);

        $after = HeritageSite::orderBy('id')->get()->toArray();
        $repeat = $this->importer()->import($source, true, $heroes->created_by);
        $this->assertSame(['already exists', 'already exists'], array_column($repeat, 'action'));
        $this->assertSame($after, HeritageSite::orderBy('id')->get()->toArray());
    }

    public function test_all_nonempty_admin_fields_coordinates_status_creator_and_name_are_preserved(): void
    {
        $values = ['name' => 'Admin renamed place', 'description' => 'Admin overview', 'history' => 'Admin history',
            'category' => 'Museums', 'year_built' => 'Admin year', 'address' => 'Admin address',
            'latitude' => 0, 'longitude' => 0, 'status' => 'archived',
            'opening_hours' => 'Admin hours', 'entrance_fee' => 'Admin fee',
            'accessibility_notes' => 'Admin accessibility', 'visit_notes' => 'Admin notes', 'contact_information' => 'Admin contact'];
        $site = $this->existing($values);
        $before = $site->getAttributes();
        $source = $this->fixture(['existing_id' => $site->id]);
        $report = $this->importer()->import($source, true, $site->created_by);
        $this->assertSame('already exists', $report[0]['action']);
        $this->assertEquals($before, $site->fresh()->getAttributes());
        $this->assertDatabaseCount('heritage_sites', 1);
    }

    public function test_new_pdf_overviews_fill_only_blank_descriptions_and_preserve_admin_content(): void
    {
        $entries = array_values(array_filter($this->master()['sites'], fn ($entry) => in_array($entry['source_number'], [17, 18, 21, 25, 31, 37], true)));
        $this->assertCount(6, $entries);
        foreach ($entries as $index => $entry) {
            $this->assertNotEmpty($entry['description'], $entry['name'].' PDF overview');
            $source = ['version' => 1, 'sites' => [$entry], 'excluded_entries' => []];
            $site = $this->existing([
                'name' => $entry['name'], 'description' => $index % 2 === 0 ? '' : '  ',
                'history' => 'Existing Admin history', 'address' => 'Existing Admin address',
                'category' => 'Museums', 'year_built' => 'Existing Admin year',
                'latitude' => 15.04, 'longitude' => 120.68, 'status' => 'archived',
            ]);
            $site->images()->create(['image_path' => '/existing-admin-cover.jpg', 'caption' => 'Existing caption', 'is_cover' => true, 'sort_order' => 2]);
            $site->timelines()->create(['year' => '1900', 'title' => 'Existing timeline', 'description' => 'Existing timeline content', 'sort_order' => 3]);
            $before = $site->getAttributes();
            $images = $site->images()->get()->toArray();
            $timelines = $site->timelines()->get()->toArray();

            $preview = $this->importer()->import($source)[0];
            $this->assertSame('would update empty fields', $preview['action']);
            $this->assertSame(['description'], $preview['fields']);
            $this->assertSame($before, $site->fresh()->getAttributes());

            $applied = $this->importer()->import($source, true, $site->created_by)[0];
            $this->assertSame('updated empty fields', $applied['action']);
            $this->assertSame(['description'], $applied['fields']);
            $after = $site->fresh()->getAttributes();
            $this->assertSame(array_replace($before, ['description' => $entry['description'], 'updated_at' => $after['updated_at']]), $after);
            $this->assertSame($images, $site->images()->get()->toArray());
            $this->assertSame($timelines, $site->timelines()->get()->toArray());

            $site->update(['description' => 'Admin revised overview']);
            $edited = $site->fresh()->getAttributes();
            foreach ([false, true] as $apply) {
                $report = $this->importer()->import($source, $apply, $site->created_by)[0];
                $this->assertSame('already exists', $report['action']);
                $this->assertSame([], $report['fields']);
                $this->assertSame($edited, $site->fresh()->getAttributes());
            }
        }
    }

    public function test_empty_fields_are_previewed_without_writes_then_filled(): void
    {
        $site = $this->existing(['description' => '  ', 'history' => '', 'opening_hours' => null]);
        $before = $site->getAttributes();
        $source = $this->fixture();
        $report = $this->importer()->import($source);
        $this->assertSame('would update empty fields', $report[0]['action']);
        $this->assertContains('description', $report[0]['fields']);
        $this->assertEquals($before, $site->fresh()->getAttributes());
        $report = $this->importer()->import($source, true, $site->created_by);
        $this->assertSame('updated empty fields', $report[0]['action']);
        foreach (['description', 'history', 'address', 'category', 'year_built', 'opening_hours', 'entrance_fee', 'accessibility_notes', 'visit_notes', 'contact_information'] as $field) {
            $this->assertSame($source['sites'][0][$field], $site->fresh()->getAttribute($field));
        }
        $this->assertEquals(15.02855, $site->fresh()->latitude);
        $this->assertEquals(120.67683, $site->fresh()->longitude);
    }

    public function test_aliases_match_exact_records_without_renaming_or_duplicates(): void
    {
        foreach (['Lazatin Residence' => 'Lazatin House', 'Augusto Paras Hizon House' => 'Augusto P. Hizon House',
            'Dayrit-Galang Residence' => 'Dayrit-Galang House'] as $alias => $canonical) {
            $site = $this->existing(['name' => $alias, 'description' => 'Admin overview']);
            $entry = collect($this->master()['sites'])->firstWhere('name', $canonical);
            $report = $this->importer()->import(['version' => 1, 'sites' => [$entry], 'excluded_entries' => []], true, $site->created_by);
            $this->assertSame($site->id, $report[0]['id']);
            $this->assertSame($alias, $site->fresh()->name);
            $this->assertSame('Admin overview', $site->fresh()->description);
        }
        $this->assertDatabaseCount('heritage_sites', 3);
    }

    public function test_name_normalization_is_limited_to_case_whitespace_and_apostrophe_typography(): void
    {
        $site = $this->existing(['name' => '  heroes   HALL and Heroes park ']);
        $report = $this->importer()->import($this->fixture(), true, $site->created_by);
        $this->assertSame($site->id, $report[0]['id']);
        $this->assertSame('  heroes   HALL and Heroes park ', $site->fresh()->name);
        $different = $this->fixture(['name' => 'Heroes Hall Annex', 'aliases' => []]);
        $this->assertSame('would create', $this->importer()->import($different)[0]['action']);
        $this->assertDatabaseCount('heritage_sites', 1);
    }

    public function test_canonical_and_alias_duplicates_are_ambiguous_and_untouched(): void
    {
        $first = $this->existing(['name' => 'Lazatin House']);
        $second = $this->existing(['name' => 'Lazatin Residence']);
        $before = HeritageSite::orderBy('id')->get()->toArray();
        $entry = collect($this->master()['sites'])->firstWhere('name', 'Lazatin House');
        $source = ['version' => 1, 'sites' => [$entry], 'excluded_entries' => []];
        foreach ([false, true] as $apply) {
            $row = $this->importer()->import($source, $apply, $first->created_by)[0];
            $this->assertSame('ambiguous match', $row['action']);
            $this->assertStringContainsString((string) $first->id, $row['reason']);
            $this->assertStringContainsString((string) $second->id, $row['reason']);
        }
        $this->assertSame($before, HeritageSite::orderBy('id')->get()->toArray());
    }

    public function test_missing_or_conflicting_existing_id_never_creates_a_replacement(): void
    {
        $this->assertSame('skipped', $this->importer()->import($this->fixture(['existing_id' => 9999]))[0]['action']);
        $first = $this->existing();
        $second = $this->existing(['name' => 'Renamed other place']);
        $this->assertSame('ambiguous match', $this->importer()->import($this->fixture(['existing_id' => $second->id]))[0]['action']);
        $source = $this->fixture(['name' => 'Lazatin House', 'existing_id' => $first->id]);
        $source['sites'][] = $this->fixture()['sites'][0];
        $source['sites'][1]['key'] = 'another-source';
        $this->assertSame('ambiguous match', $this->importer()->import($source)[0]['action']);
        $this->assertDatabaseCount('heritage_sites', 2);
    }

    public function test_unverified_coordinates_are_ignored_and_partial_existing_pairs_are_preserved(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $source = $this->fixture(['coordinates' => ['verified' => false, 'latitude' => 15, 'longitude' => 120]]);
        $this->importer()->import($source, true, $admin->id);
        $site = HeritageSite::firstOrFail();
        $this->assertNull($site->latitude);
        $this->assertNull($site->longitude);
        $site->update(['latitude' => 15.01]);
        $row = $this->importer()->import($this->fixture(), true, $admin->id)[0];
        $this->assertStringContainsString('incomplete coordinate pair preserved', $row['reason']);
        $this->assertEquals(15.01, $site->fresh()->latitude);
        $this->assertNull($site->fresh()->longitude);
    }

    public function test_invalid_source_is_rejected_before_any_records_are_written(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        foreach (['coordinate', 'category', 'alias', 'binding'] as $invalid) {
            $source = $this->fixture();
            $bad = $source['sites'][0];
            $bad['key'] = 'second';
            $bad['name'] = 'Other place';
            if ($invalid === 'coordinate') {
                $bad['coordinates']['latitude'] = 91;
            } elseif ($invalid === 'category') {
                $bad['category'] = 'Invented';
            } elseif ($invalid === 'alias') {
                $bad['aliases'] = [$source['sites'][0]['name']];
            } else {
                $bad['existing_id'] = -1;
            }
            $source['sites'][] = $bad;
            try {
                $this->importer()->import($source, true, $admin->id);
                $this->fail('Invalid source must be rejected.');
            } catch (InvalidArgumentException) {
                $this->assertDatabaseCount('heritage_sites', 0);
            }
        }
    }

    public function test_imported_sites_use_normal_api_admin_updates_and_archive_behavior(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $entry = collect($this->master()['sites'])->firstWhere('name', 'Megaworld Capital Town');
        $this->importer()->import(['version' => 1, 'sites' => [$entry], 'excluded_entries' => []], true, $admin->id);
        $site = HeritageSite::firstOrFail();
        $this->getJson('/api/heritage-sites')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $site->id);
        $this->getJson('/api/heritage-sites/'.$site->id)->assertOk()->assertJsonPath('latitude', null)
            ->assertJsonPath('longitude', null)->assertJsonCount(0, 'images');
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
        $this->patchJson('/api/heritage-sites/'.$site->id, [
            'name' => 'Admin revised name', 'description' => 'Admin revised overview', 'history' => 'Admin revised history',
            'address' => 'Admin address', 'category' => 'Museums', 'latitude' => 15.03, 'longitude' => 120.68,
            'opening_hours' => 'Admin hours',
        ], $headers)->assertOk()->assertJsonPath('name', 'Admin revised name')->assertJsonPath('opening_hours', 'Admin hours');
        $entry['existing_id'] = $site->id;
        $this->importer()->import(['version' => 1, 'sites' => [$entry], 'excluded_entries' => []], true, $admin->id);
        $this->assertSame('Admin revised overview', $site->fresh()->description);
        $this->assertEquals(15.03, $site->fresh()->latitude);
        $this->deleteJson('/api/heritage-sites/'.$site->id, [], $headers)->assertOk();
        $this->importer()->import(['version' => 1, 'sites' => [$entry], 'excluded_entries' => []], true, $admin->id);
        $this->assertSame('archived', $site->fresh()->status);
        $this->getJson('/api/heritage-sites')->assertExactJson([]);
        $this->getJson('/api/heritage-sites/'.$site->id)->assertNotFound();
        $this->getJson('/api/admin/heritage-sites/'.$site->id, $headers)->assertOk();
    }
}
