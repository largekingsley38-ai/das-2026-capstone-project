# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:**Asked the AI to write sorting.js, publishEvent, listEventSummaries, eventSearch.js and tests.
- **What came back:**Code for all of it, sent in pieces. 21 tests, all passing after fixes.
- **What was wrong (or "nothing"):**A stray s in sorting.js and a stray S plus a duplicated chunk in the test file after copying. Running the code and npm test caught them. The AI said package.json already had a test script, which was wrong. There is no unpublish function.

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

## Build 3
### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** state machine, router, server, config, tests and architecture diagrams.
- **What came back:** code sent in pieces. 34 tests passing.
- **What was wrong (or "nothing"):** the duplicated chunk happened again in app.js, so I replaced the whole file. The AI added a BAD_JSON error code the prompt did not name. Bad JSON is not tested with a real POST because there is no POST route yet.

## Build 4
**Asked:** The Build 4 prompt from docs/build-4.md: in-memory repository, event and booking services, mock payment gateway, API routes, curl examples and API tests.

**What came back:** 9 files: memory.js, mockPaymentGateway.js, eventService.js, bookingService.js, body.js, apiRoutes.js, a new app.js, test/api.test.js and docs/api-examples.md.

**What was wrong:**
- The prompt has no unpublish route, but story S04 needs one. The AI added `/unpublish` only because I pointed at the gap.
- Any user with an x-user-id can publish or add tiers to someone else's event. The prompt only said the payer must be the booker. I will fix this when logins arrive in Build 7.
- A stray letter appeared at the end of two files after pasting (`S` in apiRoutes.js, `s` in mockPaymentGateway.js). `node --check` did not catch it. `npm test` did.
- The AI gave wrong line counts three times and wrongly said a missing last line was a screen problem. I checked with tests instead of trusting it.
- A bad-JSON test was written with a leftover unused server. It passes, but it is messy.

**What I changed:** I replaced both messy files whole, re-ran npm test (47 pass) and ran every curl example by hand.

## Build 5

### Prompt 1: move to SQLite and reproduce the problem

**Asked:** The Build 5 Prompt 1 from docs/build-5.md: schema, connection, SQLite repository, seed script, oversell demo.

**What came back:** schema.sql, connection.js, sqlite.js, config.js, server.js, seed.js, oversell-demo.js, package.json scripts, and `data/` in .gitignore.

**What was wrong (or "nothing"):**
- The prompt says "the services do not change", but server.js and config.js had to change to use SQLite.
- The demo showed the problem: capacity 1, 50 bookings succeeded, 0 SOLD_OUT, seats sold 1. The database says 1 sold, but 50 bookings exist, so the data is wrong and the CHECK rule did not catch it.
- A stray `SSS` and a Save As box (wrong folder) cost time. I checked every file with `node --check` and `tail`.


### Prompt 2: fix the overselling with one atomic UPDATE

**What came back:** a new `reserveSeats` method in sqlite.js (one `UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity`), a change in bookingService.js, the same method in memory.js, and test/oversell.test.js.

**Why no lock variable and no double check:** A lock variable or a "check then save" double check still leaves a gap between reading the seats and writing them, so two buyers can both pass the check. One UPDATE does the check and the change in a single step inside the database, so only one buyer can win the last seat.

**What was wrong:**
- The Prompt 1 line "the services do not change" was wrong. bookingService.js had to change to call `reserveSeats`.
- memory.js also needed `reserveSeats`, or the old 47 tests would break.
- `cancelBooking` still does read-then-write on `sold` (`tier.sold -= quantity`), so it can lose updates. Not fixed yet.
- The old demo showed sold=1 for 50 bookings because `saveTier` overwrote `sold` with a stale number.

**How I checked:**
- Before: capacity 1, 50 succeeded, 0 SOLD_OUT, seats sold 1.
- After: capacity 1, 1 succeeded, 49 SOLD_OUT, seats sold 1.
- I removed the seat check on purpose and the SQLite oversell test failed (0 SOLD_OUT, expected 49). I put the fix back and it passed.
- `npm test`: 49 pass, 0 fail.
