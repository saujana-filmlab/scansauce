# ScanSAUce

Interactive scan-style guide for Saujana Film Lab.

Live at https://scansauce.saujanalab.com

## Content workflow

The public comparison page reads its manifest through `https://scansauce-content.saujanalab-bali.workers.dev`. Current images can remain in `assets/`, while new comparisons can be uploaded to Cloudflare R2 through the private admin page in `admin/`.

The admin opens into two rooms: **The Kitchen** for ScanSAUce and **The Library** for the future film catalogue. A server-checked Worker secret protects the entrance. Cloudflare Access can be added later as an additional outer layer.

The R2 upload API and deployment notes live in `cloudflare/worker/`. Do not publish the admin workflow until the `ADMIN_PASSCODE` Worker secret is configured and `REQUIRE_ACCESS` is set to `false` for the initial passcode-only launch.

Copyright 2026 Saujana Film Lab. All rights reserved.
