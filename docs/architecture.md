# Architecture

## Layers

```mermaid
flowchart TD
  Routes[Routes: src/http] --> Services[Services]
  Services --> Rules[Rules: src/domain]
  Services --> Repos[Repositories]
  Repos --> Data[(Data)]
```

- **Routes** read the request and send the response. They may not hold business rules or touch data directly.
- **Services** run one use case by calling rules and repositories. They may not read HTTP requests or build responses.
- **Rules** (src/domain) decide what is allowed, such as capacity and state changes. They may not do input or output, or call upwards.
- **Repositories** save and load data. They may not decide business rules.

Nothing calls upwards. Services and repositories arrive in Build 4. Today the store in `inventory.js` plays that role.

## Data model

```mermaid
erDiagram
  USER ||--o{ BOOKING : makes
  EVENT ||--o{ TIER : has
  TIER ||--o{ BOOKING : "is booked in"
  EVENT {
    string id
    string title
    string city
    string status
  }
  TIER {
    string id
    string name
    int priceCents
    int capacity
    int sold
  }
  BOOKING {
    string id
    string reference
    int quantity
    int amountCents
    string status
  }
  USER {
    string id
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```