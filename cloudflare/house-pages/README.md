# Sau House Pages host

`node build.mjs` copies the existing Sau House admin interface and its four logo assets to `dist/`. The Pages project is `saujana-house` and publishes at `https://house.saujanalab.com/`. The build contains no Map records.

The page calls `saujana-house-api.edue-christian.workers.dev`. That Worker stores the Map in a private D1 table, verifies the existing House passcode against the ScanSAUce content service, and relays Kitchen requests to that service. Neither the passcode nor customer/order data is stored in this Pages build.

After changing the House source, rebuild and deploy `dist/` with Wrangler. Keep the Pages project and Worker API deployments on the same source revision.
