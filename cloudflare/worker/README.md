# ScanSAUce content worker

This Worker keeps the public ScanSAUce site static while providing a small authenticated API for the admin page.

## What it owns

- `content/scansauce/comparisons.json` in R2
- `content/film-library/films.json` in R2 when The Library opens
- Processed ScanSAUce image variants in `scansauce/comparisons/{id}/{style}/`
- Future Film Library media in `film-library/`
- Public reads under `/content/`
- Protected writes under `/api/admin/`

## First setup

1. Create an R2 Standard bucket named `saujana-content-media` in the existing Saujana Cloudflare account.
2. Run `pnpm install` in this folder.
3. Run `pnpm exec wrangler login`.
4. Set the private room passcode with `pnpm exec wrangler secret put ADMIN_PASSCODE`.
5. Set `REQUIRE_ACCESS = "false"` for the initial passcode-only launch.
6. Run `pnpm run deploy` and enable the Production `workers.dev` URL.
7. Upload the repository's `content/comparisons.json` to the R2 key `content/scansauce/comparisons.json` before enabling the `/content/*` route.
8. Upload `content/film-library.json` to the R2 key `content/film-library/films.json` as the empty starting shelf.
9. The public and admin pages connect to `https://scansauce-content.saujanalab-bali.workers.dev` because the Worker and `saujanalab.com` zone are in different Cloudflare accounts.
10. If Cloudflare Access is added later, set `REQUIRE_ACCESS = "true"` and restrict Access to the Saujana admin email addresses.

Do not expose R2 API credentials or the admin passcode in the GitHub repository or browser JavaScript.
