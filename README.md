# ScanSAUce

Interactive scan-style guide for Saujana Film Lab.

Live at https://scansauce.saujanalab.com

## Content workflow

The public comparison page reads its manifest through `https://scansauce-content.saujanalab-bali.workers.dev`. Current images can remain in `assets/`, while new comparisons can be uploaded to Cloudflare R2 through the private admin page in `admin/`.

The admin opens into **The Map** for Saujana's site/app/project directory, **The Kitchen** for ScanSAUce, and **The Library** for the film catalogue foundation. The House is published at `https://house.saujanalab.com/` on its own Pages host. The Map records live in the private `saujana-house` D1 database through `cloudflare/house-api/`. The House API verifies the existing Sau House passcode with the ScanSAUce content Worker and relays Kitchen requests to it. The Map does not read order, customer, sales, or stock data from the other apps.

To preview locally, run a web server at the repository root (for example, `python -m http.server 8765 --bind 127.0.0.1`), open `/admin/`, and choose **Preview rooms locally**. The preview starts with an empty Map and saves edits in that browser's local storage; production records use the authenticated Worker endpoint. Opening `admin/index.html` directly still shows the original rooms.

The ScanSAUce R2 upload API and deployment notes live in `cloudflare/worker/`. The House host and Map API deployment notes live in `cloudflare/house-pages/` and `cloudflare/house-api/`.

Copyright 2026 Saujana Film Lab. All rights reserved.
