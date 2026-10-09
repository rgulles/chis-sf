<?php

namespace Tests\Unit;

use App\Services\OfficialHeritageAudit;
use PHPUnit\Framework\TestCase;

class OfficialHeritageAuditTest extends TestCase
{
    private function index(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../database/data/official_heritage_index.json'), true);
    }

    public function test_matches_aliases_flags_unsupported_duplicates_and_ambiguous_cuyugan(): void
    {
        $audit = new OfficialHeritageAudit;
        $rows = $audit->audit([
            ['id' => 1, 'name' => 'Lazatin Residence'], ['id' => 2, 'name' => 'Invented Secret Vault'],
            ['id' => 3, 'name' => 'Consunji House'], ['id' => 4, 'name' => 'Consunji House'],
            ['id' => 5, 'name' => 'Baron-Cuyugan House'], ['id' => 6, 'name' => 'Vivencio Cuyugan Monument'],
        ], $this->index());
        $this->assertSame(['OFFICIAL_ALIAS', 'NOT_IN_OFFICIAL_SOURCE', 'DUPLICATE', 'DUPLICATE', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED'], array_column(array_slice($rows, 0, 6), 'status'));
        $this->assertContains('MISSING_FROM_DATABASE', array_column($rows, 'status'));
    }

    public function test_informational_entries_are_not_locations_and_audit_cannot_write_database(): void
    {
        $index = $this->index();
        $this->assertCount(35, $index['sites']);
        $this->assertSame([2, 3, 38, 39], array_column($index['excluded_entries'], 'source_number'));
        $service = file_get_contents(__DIR__.'/../../app/Services/OfficialHeritageAudit.php');
        foreach (['->delete(', '->update(', '->save(', '::create('] as $mutation) {
            $this->assertStringNotContainsString($mutation, $service);
        }
    }
}
