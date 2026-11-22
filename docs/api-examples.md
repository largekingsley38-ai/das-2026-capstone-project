# API examples

Start the server in one Git Bash window:

```
npm start
```

Run the examples below in a second Git Bash window. Data is kept in SQLite, so it survives a restart. To start clean, use a fresh database file, for example `rm -f data/examples.db && DB_FILE=data/examples.db npm start`.

Every error comes back in the same shape: `{ "error": { "code": "...", "message": "..." } }`

Answers are wrapped: an event comes back as `{ "event": { ... } }`, a booking as `{ "booking": { ... } }`, a tier as `{ "tier": { ... } }`.

Since Build 7 you say who you are with a signed token: `Authorization: Bearer <token>`. You get the token from signup or login.

## 1. Sign up an organizer

```
curl -X POST http://localhost:3000/api/auth/signup -H "content-type: application/json" -d '{"email":"org1@example.com","password":"password123","role":"organizer"}'
```

Expect 201 and `{ "user": ..., "token": "..." }`. Copy the token, then save it:

```
export ORG_TOKEN=PASTE_THE_TOKEN_HERE
```

If the email is already used you get `EMAIL_TAKEN`. Log in instead with `POST /api/auth/login` and the same body (without `role`).

## 2. Create an event (organizer only)

```
curl -X POST http://localhost:3000/api/events -H "Authorization: Bearer $ORG_TOKEN" -H "content-type: application/json" -d '{"title":"Lagos Jazz Night","city":"Lagos","venue":"Eko Hall","startsAt":"2027-12-05T18:00:00Z"}'
```

Expect 201. Copy the event `id` from inside `event`. An attendee token gets `FORBIDDEN`.

## 3. Add a ticket tier

Replace EVENT_ID with the id from step 2. Money is whole cents.

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers -H "Authorization: Bearer $ORG_TOKEN" -H "content-type: application/json" -d '{"name":"Regular","priceCents":5000,"capacity":50}'
```

Expect 201. Copy the tier `id` from inside `tier`.

## 4. Publish the event

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish -H "Authorization: Bearer $ORG_TOKEN"
```

Expect 200 and `"status":"published"`. Another organizer's token gets `FORBIDDEN`.

## 5. Unpublish the event (optional)

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/unpublish -H "Authorization: Bearer $ORG_TOKEN"
```

Publish it again before step 8 if you ran this.

## 6. Search published events (no token needed)

```
curl "http://localhost:3000/api/events?city=lagos&sort=price"
```

Query options: `q`, `city`, `from`, `to`, `maxPriceCents`, `onlyAvailable=true`, `sort=date|price|availability`.

## 7. Sign up an attendee

```
curl -X POST http://localhost:3000/api/auth/signup -H "content-type: application/json" -d '{"email":"ada@example.com","password":"password123"}'
```

The role defaults to attendee. Copy the token and save it:

```
export ADA_TOKEN=PASTE_THE_TOKEN_HERE
```

## 8. Book tickets

Replace TIER_ID with the id from step 3.

```
curl -X POST http://localhost:3000/api/bookings -H "Authorization: Bearer $ADA_TOKEN" -H "content-type: application/json" -d '{"tierId":"TIER_ID","quantity":2}'
```

Expect 201 and `"status":"pending"`. Copy the booking `reference`. The seats are held for a short time, then released if you do not pay.

## 9. Pay with a declined card

Replace REFERENCE with the code from step 8.

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay -H "Authorization: Bearer $ADA_TOKEN" -H "content-type: application/json" -d '{"decline":true}'
```

Expect 402 and `PAYMENT_DECLINED`. The booking stays pending.

## 10. Pay successfully

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay -H "Authorization: Bearer $ADA_TOKEN" -H "content-type: application/json" -d '{}'
```

Expect 200 and `"status":"paid"`. Someone else's token gets `FORBIDDEN`.

## 11. See your own bookings

```
curl http://localhost:3000/api/bookings -H "Authorization: Bearer $ADA_TOKEN"
```

Only the bookings of the token's owner are listed.

## 12. Preview the refund, then cancel a paid booking

```
curl http://localhost:3000/api/bookings/REFERENCE/refund-preview -H "Authorization: Bearer $ADA_TOKEN"
curl -X POST http://localhost:3000/api/bookings/REFERENCE/cancel -H "Authorization: Bearer $ADA_TOKEN"
```

The refund is 100% at 7 or more days before the event, 50% from 2 days up to 7 days, and 0% under 2 days. Expect 200, `"status":"refunded"` and a `refund` with `refundCents` and `percent`. The seats are released.

## 13. Cancel an unpaid booking

Book again (step 8), then use the new reference:

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/cancel -H "Authorization: Bearer $ADA_TOKEN"
```

Expect 200 and `"status":"cancelled"`, with a refund of 0.
