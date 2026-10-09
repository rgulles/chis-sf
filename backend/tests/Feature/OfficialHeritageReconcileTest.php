<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\User;
use App\Services\OfficialHeritageReconciler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfficialHeritageReconcileTest extends TestCase
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
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('Only in-memory SQLite is allowed.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    public function test_dry_run_is_default_and_apply_requires_admin_and_review_then_archives_without_deleting(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $site = HeritageSite::create(['created_by' => $admin->id, 'name' => 'Test', 'status' => 'active', 'address' => 'Admin address', 'description' => 'Admin text', 'history' => 'Admin history']);
        $site->timelines()->create(['year' => '1900', 'title' => 'Recorded', 'description' => 'Retain']);
        $reconciler = app(OfficialHeritageReconciler::class);
        $preview = $reconciler->reconcile();
        $this->assertSame('active', $site->fresh()->status);
        $this->artisan('heritage:reconcile-official', ['--apply' => true])->assertExitCode(1);
        $this->assertSame('active', $site->fresh()->status);
        $reconciler->reconcile(true, $admin->id, $preview['fingerprint']);
        $this->assertSame('archived', $site->fresh()->status);
        $this->assertSame('Admin history', $site->fresh()->history);
        $this->assertSame(1, $site->timelines()->count());
        $this->assertSame(1, HeritageSite::count());
    }

    public function test_stale_preview_cannot_apply_and_duplicate_cuyugan_records_remain_untouched(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        foreach (['San Fernando Cathedral', 'Metropolitan Cathedral', 'Baron-Cuyugan House', 'Vivencio Cuyugan Monument', 'Lazatin Residence'] as $name) {
            HeritageSite::create(['created_by' => $admin->id, 'name' => $name, 'status' => 'active', 'address' => '', 'description' => '', 'history' => '']);
        }
        $reconciler = app(OfficialHeritageReconciler::class);
        $preview = $reconciler->reconcile();
        $this->assertCount(1, $preview['changes']);
        $this->assertSame('Lazatin House', $preview['changes'][0]['to']);
        HeritageSite::where('name', 'Lazatin Residence')->update(['name' => 'Lazatin House']);
        $this->artisan('heritage:reconcile-official', ['--apply' => true, '--created-by' => $admin->id, '--reviewed-fingerprint' => $preview['fingerprint']])->assertExitCode(1);
        $this->assertSame(5, HeritageSite::where('status', 'active')->count());
    }
}
