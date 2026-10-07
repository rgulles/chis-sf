<?php

namespace App\Services;

use App\Models\HeritageSite;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CsfpHeritageImporter
{
    private const TEXT_FIELDS = [
        'name', 'category', 'year_built', 'address', 'description', 'history',
        'opening_hours', 'entrance_fee', 'accessibility_notes', 'visit_notes', 'contact_information',
    ];

    public function readSource(string $path): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new InvalidArgumentException('Import source is not a readable JSON file.');
        }

        $source = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $this->validateSource($source);

        return $source;
    }

    public function import(array $source, bool $apply = false, ?int $creatorId = null): array
    {
        // Validate the entire source before any database writes.
        $this->validateSource($source);
        if ($apply && (! $creatorId || ! User::whereKey($creatorId)->where('role', 'admin')->exists())) {
            throw new InvalidArgumentException('Applying an import requires --created-by with an existing admin user ID.');
        }

        return DB::transaction(function () use ($source, $apply, $creatorId) {
            $existing = HeritageSite::query()->when($apply, fn ($query) => $query->lockForUpdate())->get();
            $nameOwners = [];
            foreach ($source['sites'] as $entry) {
                foreach ([$entry['name'], ...($entry['aliases'] ?? [])] as $name) {
                    $nameOwners[$this->normalizeName($name)] = $entry['key'];
                }
            }
            $report = [];

            foreach ($source['sites'] as $entry) {
                $row = ['key' => $entry['key'], 'name' => $entry['name'], 'id' => null, 'fields' => [], 'reason' => ''];
                if ($entry['review_required'] ?? false) {
                    $report[] = $row + ['action' => 'skipped'];
                    $report[array_key_last($report)]['reason'] = $entry['review_note'] ?? 'Manual source review required.';

                    continue;
                }

                $names = array_map($this->normalizeName(...), [$entry['name'], ...($entry['aliases'] ?? [])]);
                $matches = $existing->filter(fn ($site) => in_array($this->normalizeName($site->name), $names, true));
                if (isset($entry['existing_id'])) {
                    $bound = $existing->firstWhere('id', $entry['existing_id']);
                    if (! $bound) {
                        $report[] = array_replace($row, ['action' => 'skipped', 'reason' => 'Reviewed existing_id does not exist; no replacement created.']);

                        continue;
                    }
                    $owner = $nameOwners[$this->normalizeName($bound->name)] ?? $entry['key'];
                    if ($owner !== $entry['key']) {
                        $report[] = array_replace($row, ['action' => 'ambiguous match', 'reason' => 'existing_id belongs to another source identity: '.$owner.'; nothing changed.']);

                        continue;
                    }
                    $matches = $matches->push($bound)->unique('id');
                }

                if ($matches->count() > 1) {
                    $report[] = array_replace($row, ['action' => 'ambiguous match', 'reason' => 'Matching database IDs: '.$matches->pluck('id')->implode(', ').'; nothing changed.']);

                    continue;
                }

                $values = $this->sourceValues($entry);
                $site = $matches->first();
                if (! $site) {
                    $row['action'] = $apply ? 'created' : 'would create';
                    $row['fields'] = array_keys($values);
                    if ($apply) {
                        $site = HeritageSite::create(array_replace([
                            'description' => '', 'history' => '', 'address' => '',
                            'latitude' => null, 'longitude' => null,
                        ], $values, ['created_by' => $creatorId, 'status' => 'active']));
                        $row['id'] = $site->id;
                        $existing->push($site);
                    }
                } else {
                    $row['id'] = $site->id;
                    $updates = [];
                    foreach (self::TEXT_FIELDS as $field) {
                        if (array_key_exists($field, $values) && $this->isEmpty($site->getAttribute($field))) {
                            $updates[$field] = $values[$field];
                        }
                    }
                    // Coordinates are an atomic pair: never combine a source coordinate
                    // with an existing Admin coordinate, even when that pair is incomplete.
                    if (isset($values['latitude'], $values['longitude'])
                        && $this->isEmpty($site->latitude) && $this->isEmpty($site->longitude)) {
                        $updates['latitude'] = $values['latitude'];
                        $updates['longitude'] = $values['longitude'];
                    }
                    $row['fields'] = array_keys($updates);
                    $row['action'] = $updates ? ($apply ? 'updated empty fields' : 'would update empty fields') : 'already exists';
                    if ($apply && $updates) {
                        $site->update($updates);
                    }
                    if ($this->isEmpty($site->latitude) !== $this->isEmpty($site->longitude)) {
                        $row['reason'] = 'Existing incomplete coordinate pair preserved; Admin review required.';
                    }
                }
                $report[] = $row;
            }

            foreach ($source['excluded_entries'] as $entry) {
                $report[] = ['key' => 'excluded-'.$entry['source_number'], 'name' => $entry['name'],
                    'id' => null, 'fields' => [], 'action' => 'skipped', 'reason' => $entry['reason']];
            }

            return $report;
        });
    }

    private function sourceValues(array $entry): array
    {
        $values = [];
        foreach (self::TEXT_FIELDS as $field) {
            if (! $this->isEmpty($entry[$field] ?? null)) {
                $values[$field] = trim($entry[$field]);
            }
        }
        $coordinates = $entry['coordinates'] ?? [];
        if (($coordinates['verified'] ?? false) === true) {
            $values['latitude'] = $coordinates['latitude'];
            $values['longitude'] = $coordinates['longitude'];
        }

        return $values;
    }

    private function isEmpty(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }

    private function normalizeName(string $name): string
    {
        // No fuzzy matching, substring matching, accent removal or punctuation stripping.
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim(str_replace(['’', '‘'], "'", $name))));
    }

    private function validateSource(mixed $source): void
    {
        if (! is_array($source) || ($source['version'] ?? null) !== 1
            || ! is_array($source['sites'] ?? null) || ! array_is_list($source['sites'])
            || ! is_array($source['excluded_entries'] ?? null) || ! array_is_list($source['excluded_entries'])) {
            throw new InvalidArgumentException('Invalid import source structure/version.');
        }
        $names = $keys = $bindings = [];
        foreach ($source['sites'] as $entry) {
            if (! is_array($entry) || ! is_string($entry['key'] ?? null) || $this->isEmpty($entry['key'])
                || ! is_string($entry['name'] ?? null) || $this->isEmpty($entry['name'])
                || ! in_array($entry['category'] ?? null, HeritageSite::CATEGORIES, true)
                || ! is_array($entry['aliases'] ?? []) || ! array_is_list($entry['aliases'] ?? [])) {
                throw new InvalidArgumentException('Invalid site identity/category/aliases.');
            }
            if (isset($keys[$entry['key']])) {
                throw new InvalidArgumentException('Duplicate source key: '.$entry['key']);
            }
            $keys[$entry['key']] = true;
            foreach ([$entry['name'], ...($entry['aliases'] ?? [])] as $name) {
                if (! is_string($name) || $this->isEmpty($name)) {
                    throw new InvalidArgumentException('Aliases must be non-empty strings.');
                }
                $normalized = $this->normalizeName($name);
                if (isset($names[$normalized]) && $names[$normalized] !== $entry['key']) {
                    throw new InvalidArgumentException('Conflicting source alias: '.$name);
                }
                $names[$normalized] = $entry['key'];
            }
            foreach (self::TEXT_FIELDS as $field) {
                if (isset($entry[$field]) && ! is_string($entry[$field])) {
                    throw new InvalidArgumentException('Source text must be a string or null: '.$field);
                }
            }
            foreach (['name', 'address', 'year_built'] as $field) {
                if (mb_strlen($entry[$field] ?? '') > 255) {
                    throw new InvalidArgumentException('Source text exceeds database limit: '.$field);
                }
            }
            if (isset($entry['review_required']) && ! is_bool($entry['review_required'])) {
                throw new InvalidArgumentException('review_required must be boolean.');
            }
            if (isset($entry['existing_id'])) {
                if (! is_int($entry['existing_id']) || $entry['existing_id'] < 1 || isset($bindings[$entry['existing_id']])) {
                    throw new InvalidArgumentException('existing_id must be a unique positive database ID.');
                }
                $bindings[$entry['existing_id']] = true;
            }
            $coordinates = $entry['coordinates'] ?? [];
            if (! is_array($coordinates) || ! is_bool($coordinates['verified'] ?? false)) {
                throw new InvalidArgumentException('Invalid coordinate verification metadata.');
            }
            if (($coordinates['verified'] ?? false) === true) {
                foreach (['latitude' => 90, 'longitude' => 180] as $field => $limit) {
                    $value = $coordinates[$field] ?? null;
                    if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value) || abs($value) > $limit) {
                        throw new InvalidArgumentException('Invalid verified coordinate: '.$field);
                    }
                }
            }
        }
        foreach ($source['excluded_entries'] as $entry) {
            if (! is_array($entry) || ! is_int($entry['source_number'] ?? null)
                || ! is_string($entry['name'] ?? null) || $this->isEmpty($entry['name'])
                || ! is_string($entry['reason'] ?? null) || $this->isEmpty($entry['reason'])
                || isset($names[$this->normalizeName($entry['name'])])) {
                throw new InvalidArgumentException('Invalid or conflicting excluded content entry.');
            }
        }
    }
}
