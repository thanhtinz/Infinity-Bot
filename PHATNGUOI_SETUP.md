# Phạt nguội lookup — setup & research notes

`/phatnguoi` looks up Vietnamese traffic-camera violations ("phạt nguội") by license
plate. The command, plate validation/normalization, and Discord reply formatting are fully
implemented. What is **not** wired up out of the box is an actual data source, because there
is no legitimate, publicly-documented API for this that's safe to build against. This document
explains what was found and what a bot owner needs to do to make the lookup actually return
data.

## What was researched

1. **Official source — csgt.vn (Cục Cảnh sát giao thông)**
   `https://www.csgt.vn/tra-cuu-phuong-tien-vi-pham.html` is the authoritative government
   lookup. Submitting a plate lookup requires solving an interactive CAPTCHA image in the
   browser. There is no documented API — every third-party project that uses this data
   (e.g. `anyideaz/phatnguoi-api`, `chiraitori/phatnguoicheck-go`) works by scraping this page
   and automating the CAPTCHA (OCR, retry loops, etc.). That is exactly the kind of anti-bot
   circumvention this project intentionally does not build.

2. **Official mobile app — VNeTraffic**
   VNeTraffic is the real, officially sanctioned app (Bộ Công an, operated by GTEL) and
   supports phạt nguội lookup, VNeID linking, etc. It is app-only and does not expose a public
   API for third-party bots/websites to call.

3. **Third-party consumer websites** — `phatnguoi.vn`, `phatnguoi.app`, `phatnguoi.com`,
   `checkphatnguoi.vn`, and similar. These are all human-facing lookup forms aimed at
   consumers. None of them publish developer/API documentation, an API key signup flow, or
   terms for programmatic integration. (They are also explicitly **not** affiliated with the
   Ministry of Public Security — several of them say so themselves.) Without a documented,
   integration-intended contract, treating these as an API would mean reverse-engineering a
   page built for interactive human use, which is out of scope here.

4. **Community "APIs" on GitHub** (`anyideaz/phatnguoi-api`, `check-phat-nguoi/*`, Postman
   collections referencing `csgt.vn`, etc.) — these are all wrappers around #1, i.e. scrapers
   with CAPTCHA-solving logic bolted on. Same concern as #1.

**Conclusion:** there is currently no legitimate, publicly-documented API intended for
third-party integration for "tra phạt nguội." The only fetchable programmatic path found is
CAPTCHA-gated (official) or an undocumented scrape of a human-facing form (unofficial), so no
scraper was built.

## What was built instead

`src/bot/utils/phatnguoiClient.js` defines a small adapter with an honest fail-closed contract:

- `normalizePlate(raw)` — validates/normalizes plate input (accepts `30A-12345`, `30A12345`,
  `30A 123.45`, etc.).
- `lookupViolations({ plate, vehicleType })` — if `PHATNGUOI_API_BASE_URL` is not set, throws
  `PhatNguoiNotConfiguredError` immediately (no network call, no fake data). If it *is* set,
  it calls:

  ```
  GET {PHATNGUOI_API_BASE_URL}/lookup?plate=<plate>&type=<oto|xemay|xedap-dien>
  Authorization: Bearer <PHATNGUOI_API_KEY>   (only sent if the key is set)
  ```

  and expects a JSON response shaped like:

  ```json
  { "violations": [
      { "date": "12/05/2026", "location": "QL1A, Bình Dương", "description": "Quá tốc độ", "status": "Chưa xử lý" }
  ] }
  ```

`/phatnguoi` surfaces a clear "not configured, see PHATNGUOI_SETUP.md" message to the Discord
user when the adapter isn't configured, rather than crashing or returning invented data.

## How to actually wire this up

You (the bot owner) have a few legitimate options, each at your own discretion/risk since none
of this is an officially blessed integration path:

- **Self-host an open-source lookup tool you control** (e.g. one of the CAPTCHA-OCR projects
  linked above), running as your own service that you are responsible for operating within
  csgt.vn's terms of use. Put its base URL in `PHATNGUOI_API_BASE_URL`. If it doesn't already
  match the JSON contract above, add a thin translation layer in front of it (or adjust
  `lookupViolations()` in `phatnguoiClient.js`) so the shape matches.
- **Use the VNeTraffic app manually** for one-off lookups — no bot integration possible today,
  since it has no public API.
- **Watch for an official API announcement** from Cục CSGT/Bộ Công an — none exists as of this
  writing (July 2026).

Once you have a real endpoint, set in `.env`:

```
PHATNGUOI_API_BASE_URL=https://your-lookup-service.example.com
PHATNGUOI_API_KEY=your-key-if-required
```

and `/phatnguoi` will start returning real results automatically — no code changes needed
beyond matching the response contract above.
