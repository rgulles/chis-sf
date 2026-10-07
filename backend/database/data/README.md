# CSFP heritage import foundation

`csfp_heritage_master.json` is backend import metadata only. Laravel/MySQL remains
the runtime source for the public API and all React views. This file is never
loaded by a visitor view and never overrides a saved database field at runtime.

The source is the project owner's supplied City Tourism list, address excerpts,
and explicitly verified initial coordinates. The complete PDF text was not
available when this foundation was implemented. Descriptions, history, years,
visitor information and images have **not** been invented. Unknown required
database text fields are created as empty strings; unknown coordinates are null.
Admin can populate them through the existing management flow.

## Structure and coverage

- `version`, `source`: format version and provenance/limitations.
- `sites`: 35 physical candidates with stable import keys, original list numbers,
  canonical names, explicit aliases, existing CHIS categories, supplied addresses,
  nullable source text, and coordinate verification metadata.
- `excluded_entries`: National Heroes, Local Heroes, Kalesa Tour, Lantern Making.
  These four concepts are reported but never imported as location records.
- `review_required`, `review_note`, `source_label`: review gates/provenance.
- Optional `existing_id`: a **manually reviewed, deployment-specific** database ID
  binding for a record renamed by Admin. Do not copy IDs between databases.

There are 20 supplied addresses and 22 owner-verified coordinate pairs, including
the house-only pair in the gated Cuyugan candidate. Categories: 23 Historical
Buildings, 7 Cultural Sites, 2 Churches, 2 Monuments, 1 Museum. Category assignments
are conservative CHIS classifications, not PDF quotations.

The Cuyugan source groups a house and Vivencio Cuyugan Monument. Its candidate
name is Baron-Cuyugan House; the verified pair applies to the house only. This
entry is **skipped**, including when a matching house already exists, until the
owner reviews the grouping and changes `review_required` in a reviewed source.
The monument and the combined title are deliberately not house aliases.

## Review first

From the backend directory:

```sh
php artisan heritage:import-csfp --dry-run
```

Running `php artisan heritage:import-csfp` with no options is also a dry run.
Neither preview creates/updates database records or creates a user.

The table reports source key, name, database ID, action, fields and review notes:

- `already exists`: one exact identity match, no source-backed empty fields to fill.
- `would create`: no match; a new active record would be created.
- `would update empty fields`: one match; only the listed empty fields would change.
- `skipped`: excluded concept, manual review gate, or nonexistent `existing_id`.
- `ambiguous match`: multiple matching IDs or a conflicting binding; nothing changes.

An empty database previews **34 would create and 5 skipped**: four excluded
concepts plus the gated Cuyugan candidate. Existing databases produce different
counts. Successful preview exit status does not imply skipped rows are resolved.

Inspect **every `would create` row** against the current Admin catalogue. Exact
matching cannot discover an arbitrary Admin rename or an undocumented alias.
Add a reviewed alias or `existing_id` before applying/reapplying to a renamed
record; otherwise it is indistinguishable from a missing site and could become a
duplicate. Keep any deployment-specific ID bindings in a reviewed local copy:

```sh
php artisan heritage:import-csfp --dry-run --source=/path/to/reviewed-master.json
```

Only after the preview has been reviewed, an operator can explicitly write:

```sh
php artisan heritage:import-csfp --apply --created-by=ADMIN_USER_ID
```

Use the same `--source` for preview and apply if using a reviewed local copy.
`--created-by` must identify an existing admin. No user is automatically selected
or created. The importer does not run via migrations, seeders, HTTP endpoints,
application startup or scheduled tasks. No shared MySQL import was performed
during implementation.

## Preservation and operational limits

Matching normalizes case, surrounding/repeated whitespace and curly apostrophes
only. It uses the canonical name, explicit aliases, or a reviewed ID. No fuzzy
matching, substring matching or punctuation stripping is used. Conflicting source
identities are rejected before writes; ambiguous database matches are skipped.

For a match, only null/blank fields with a nonblank supplied value are filled.
Nonempty name, category, description, history, address, year, visitor information,
creator and status are retained. Coordinate pairs are filled only when **both**
existing values are empty and the source pair is verified and valid. Zero is a
real value. Partial existing pairs are preserved and flagged for Admin review.
Unverified source coordinates are ignored, even if numeric values are present.
Images/timelines are never written or removed. New records use normal numeric IDs
and the existing frontend neutral image fallback. Imported records are ordinary,
editable HeritageSite records with no runtime source link or locking policy.

Applying is transactional. A local process lock serializes command runs on this
installation; coordinate operators if multiple hosts share one database. There
is no new database import-key column or cross-host uniqueness constraint. Run
imports serially, and avoid simultaneous Admin edits during an apply operation.

Manual review remains necessary for the Cuyugan grouping, arbitrary renamed
records, category interpretations, missing PDF text, missing coordinates and
missing official images. The supplied Calulut church coordinate is valid but
north of the current map's restricted project extent; a future map-scope review
may be needed. This import does not alter MapView bounds or substitute coordinates.
