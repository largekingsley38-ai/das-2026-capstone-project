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

## Build 6

### Prompt 1: frontend on mock data

**What came back:** public/index.html, public/event.html, public/js/ui.js, mockData.js, api.js, public/js/pages/home.js and event.js, and public/css/styles.css.

**What was wrong:**
- The real API has no "one event" route, so getEvent in api.js uses my own shape (event plus tiers). It must be fixed before the site talks to the real server.
- The real answer shape for booking and pay was a guess. I must check it with curl before Build 7.
- After tapping Book tickets, the seat count did not update until payment. I found it in the browser and added `await load();` after booking.
- The AI wrongly said the count would reset to 38 after F5, and wrongly said 37 was wrong. I tested instead of trusting it.
- A typo in a comment in home.js: "an newer search".
- home.js and event.js use top-level await, so `node --check` cannot read them. I checked the last lines and the browser instead.

## Build 7

### Prompt 1: connect the frontend to the real API

**What came back:** a new GET /api/events/:id route (getPublishedEvent in eventService.js), 3 tests in test/eventOne.test.js, and a new public/js/api.js that calls the real server.

**What was wrong:**
- The Build 6 api.js guessed the one-event shape. The real server had no such route, so it gave NOT_FOUND. I added the route and it returns event plus tiers with seatsLeft.
- The mock used the error code INVALID_STATE for paying twice. The real server uses INVALID_TRANSITION (HTTP 409).
- The mock booking had holdExpiresAt. The real booking does not. api.js now adds it from createdAt plus HOLD_SECONDS, for the countdown display only.
- The AI's first commands were too long and the screenshots cut off, so I had to ask again.

**How I checked:**
- curl: draft event gives 404, published gives 200. Book gives 201 with a reference, status pending and amountCents. Declined pay gives 402 PAYMENT_DECLINED. Good pay gives 200 and status paid. Pay again gives 409. Errors look like { error: { code, message } }.
- Browser: seat count, countdown, declined card and good payment all worked on the real server.
- npm test: 52 pass, 0 fail.

## Build 8

### Prompt 1: refunds, expiry, waitlist, website

**What came back:** clock.js, refundPolicy.js, holdPolicy.js, waitlistService.js, jobs/maintenance.js, a waitlist_entries table, repository methods (releaseSeats, changeBookingStatus, waitlist methods), new routes, eventExtras.js, and 4 new test files.

**What was wrong:**
- An old test in api.test.js said a paid booking cannot be cancelled (409). The new rule is refund, so I changed it to 200 and status refunded.
- That same test used an event date in 2026. After that date the refund rule says the event has started, so the test would break by itself. I moved the date to 2030.
- The brief says a cancelled paid booking becomes "cancelled". The AI made it "refunded", because the state machine already has that state. I am not sure which one the instructor wants.
- At 0% refund the booking is still marked refunded, but the gateway refund is not called.
- The old waitlist code in inventory.js (joinWaitlist, offerNextOnWaitlist) and the Queue class only live in memory. The AI stored the waitlist in the database instead, so those old functions are no longer used.
- The hold time 600 seconds is written in two places (mockData.js and holdPolicy.js).
- The waitlist is strict first-in-first-out. If the first person wants more seats than are free, the whole line waits.
- The server job runs every 30 seconds, so an expired hold or offer can be cleaned up to 30 seconds late. Accepting an expired offer is still refused straight away.
- While testing in the browser I tapped Join waitlist twice, so I had two entries. That was my mistake, not a bug.
- The AI guessed a NO MATCH message was a second run of the patch. I checked with git status and the tests.
- No automated tests yet for the waitlist HTTP routes or the refund-preview route. I only tested those in the browser.

**How I checked:**
- Tests for every refund boundary (exactly 7 days, 6 days 23 hours, exactly 2 days, 1 day 23 hours), cancelling twice, waitlist order, offer expiry passing to the next person, and unpaid hold expiry.
- Browser and database: joined the waitlist, freed the seat, the offer was accepted, paid, cancelled with the refund shown first, and the tier went back to sold 0.
- npm test: 78 pass, 0 fail.