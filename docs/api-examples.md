# API examples (Build 4)

Start the server in one Git Bash window:

```
npm start
```

Run the examples below in a second Git Bash window. The server keeps data in memory, so everything is erased when you stop it.

Every error comes back in the same shape: `{ "error": { "code": "...", "message": "..." } }`

Until Build 7, you say who you are with the `x-user-id` header.

## 1. Create an event (organizer)

```
curl -X POST http://localhost:3000/api/events -H "x-user-id: org1" -H "content-type: application/json" -d '{"title":"Lagos Jazz Night","city":"Lagos","venue":"Eko Hall","startsAt":"2026-12-05T18:00:00Z"}'
```

Expect 201. Copy the event `id` from the answer.

## 2. Add a ticket tier

Replace EVENT_ID with the id from step 1. Money is whole cents.

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers -H "x-user-id: org1" -H "content-type: application/json" -d '{"name":"Regular","priceCents":5000,"capacity":50}'
```

Expect 201. Copy the tier `id`.

## 3. Publish the event

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish -H "x-user-id: org1"
```

Expect 200 and `"status":"published"`.

## 4. Unpublish the event (optional)

```
curl -X POST http://localhost:3000/api/events/EVENT_ID/unpublish -H "x-user-id: org1"
```

Publish it again before step 6 if you ran this.

## 5. Search published events (attendee)

```
curl "http://localhost:3000/api/events?city=lagos&sort=price"
```

Query options: `q`, `city`, `from`, `to`, `maxPriceCents`, `onlyAvailable=true`, `sort=date|price|availability`.

## 6. Book tickets

Replace TIER_ID with the id from step 2.

```
curl -X POST http://localhost:3000/api/bookings -H "x-user-id: ada" -H "content-type: application/json" -d '{"tierId":"TIER_ID","quantity":2}'
```

Expect 201 and `"status":"pending"`. Copy the booking `reference`.

## 7. Pay with a declined card

Replace REFERENCE with the code from step 6.

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay -H "x-user-id: ada" -H "content-type: application/json" -d '{"decline":true}'
```

Expect 402 and `PAYMENT_DECLINED`. The booking stays pending.

## 8. Pay successfully

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay -H "x-user-id: ada" -H "content-type: application/json" -d '{}'
```

Expect 200 and `"status":"paid"`.

## 9. Cancel an unpaid booking

Book again (step 6), then use the new reference:

```
curl -X POST http://localhost:3000/api/bookings/REFERENCE/cancel -H "x-user-id: ada"
```

Expect 200 and `"status":"cancelled"`. A paid booking gives 409 for now (refunds come in Build 8).