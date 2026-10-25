# Sau House status API

The `saujana-house-api` Worker keeps the Map's editable records in the private `saujana-house` D1 database. It checks each Map request against the existing ScanSAUce admin session endpoint, so the House uses the same passcode. It also relays Kitchen and Library content requests for the separate House hostname without changing the original ScanSAUce Worker.

The starter records are stored directly in D1; do not bundle the catalog into the public Pages assets or GitHub source. Edits use an atomic revision check to avoid silently overwriting another staff member's change. Do not put customer details or credentials in this catalog.

Run `node --test test/worker.test.mjs` before deployment. The database schema is in `schema.sql`; apply it to the named D1 database before deploying. The `wrangler.toml` binding and backend origin are production settings.
