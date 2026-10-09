<?php

namespace App\Services;

class OfficialHeritageAudit
{
    public function index(): array
    {
        return json_decode(file_get_contents(database_path('data/official_heritage_index.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    public function normalize(string $name): string
    {
        return trim(preg_replace('/[^\pL\pN]+/u', ' ', mb_strtolower($name)));
    }

    /** Names are matched exactly after punctuation normalization; never infer identity from coordinates. */
    public function audit(iterable $records, ?array $index = null): array
    {
        $index ??= $this->index();
        $rows = [];
        $seen = [];
        foreach ($records as $record) {
            $name = $record['name'];
            $matches = array_values(array_filter($index['sites'], fn ($entry) => in_array($this->normalize($name), array_map($this->normalize(...), [$entry['name'], ...$entry['aliases']]), true)));
            $entry = count($matches) === 1 ? $matches[0] : null;
            $status = ! $matches ? 'NOT_IN_OFFICIAL_SOURCE' : (! $entry || $entry['review_required'] ? 'REVIEW_REQUIRED' : ($this->normalize($name) === $this->normalize($entry['name']) ? 'OFFICIAL_MATCH' : 'OFFICIAL_ALIAS'));
            $rows[] = ['id' => $record['id'] ?? null, 'name' => $name, 'official_match' => $entry['name'] ?? null, 'source_number' => $entry['source_number'] ?? null, 'status' => $status,
                'recommended_action' => match ($status) {
                    'NOT_IN_OFFICIAL_SOURCE' => ($record['status'] ?? null) === 'archived' ? 'Already archived; preserve record and relationships. Never delete.' : 'Review then archive; preserve images, contributions, visits and itinerary history. Never delete.',
                    'REVIEW_REQUIRED' => 'Manual PDF/identity/coordinate review; Cuyugan house and monument must not be combined.',
                    'OFFICIAL_ALIAS' => 'Review canonical name correction; preserve record ID and relationships.',
                    default => 'Preserve; compare detail fields with supplied replacement PDF before changes.',
                }];
            if ($entry) {
                $seen[$entry['source_number']][] = count($rows) - 1;
            }
        }
        foreach ($seen as $number => $positions) {
            if (count($positions) < 2) {
                continue;
            }
            foreach ($positions as $position) {
                if ($number === 22) {
                    continue;
                } // Potential house/monument pair is ambiguous, not a proven duplicate.
                $rows[$position]['status'] = 'DUPLICATE';
                $rows[$position]['recommended_action'] = 'Manual duplicate review; preserve IDs and all relationships. Do not merge or delete automatically.';
            }
        }
        foreach ($index['sites'] as $entry) {
            if (isset($seen[$entry['source_number']])) {
                continue;
            }
            $rows[] = ['id' => null, 'name' => '', 'official_match' => $entry['name'], 'source_number' => $entry['source_number'], 'status' => 'MISSING_FROM_DATABASE',
                'recommended_action' => $entry['review_required'] ? 'Manual Cuyugan house/monument review before creating any location.' : 'Review PDF details before creating; no invented coordinates or visitor information.'];
        }

        return $rows;
    }
}
