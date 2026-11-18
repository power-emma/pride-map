# PrideMap Public Data API

The public API provides a stable data interface independent of the map UI. It
is read-only and requires no authentication. In the deployed application the
API base URL is `/api/v1`; when connecting directly to the Node server, the
base path is `/v1`.

The data is read from the same PostgreSQL database used by the map. Only live
organizations and public events are returned. User accounts, pending
submissions, ownership data, and private submitter contact details are never
included.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/regions` | List regions and their stable slugs |
| `GET` | `/api/v1/organizations` | List organizations |
| `GET` | `/api/v1/organizations.csv` | Download all matching organizations as CSV |
| `GET` | `/api/v1/events` | List events, including past events |
| `GET` | `/api/v1/events.csv` | Download all matching events as CSV |

### Filters and pagination

`organizations` and `events` accept:

| Parameter | Meaning |
|---|---|
| `region` | Stable region slug, such as `ottawa` or `toronto`; omit for all regions |
| `limit` | JSON page size, default `100`, maximum `500` |
| `offset` | Number of records to skip, default `0`, maximum `100000` |

The event endpoints also accept `upcoming=true` to include events from today
forward. The default (`upcoming` omitted or `false`) includes past events too.
CSV exports ignore `limit` and `offset` and include the complete matching
dataset, so they can be used for reports.

Responses are ordered consistently: organizations by name, and events by date,
time, and ID. JSON list responses use this envelope:

```json
{
  "data": [],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 0
  }
}
```

`GET /api/v1/regions` returns `{ "data": [...] }` without pagination.

### Example requests

```text
GET /api/v1/organizations?region=ottawa
GET /api/v1/events?region=toronto&upcoming=true&limit=25
GET /api/v1/organizations.csv?region=ottawa
GET /api/v1/events.csv?upcoming=true
```

## Data schema

Every JSON value is present in the response. Unknown optional values are
`null`; collection fields are empty arrays rather than `null`.

### Organization

```json
{
  "id": 42,
  "name": "Example Organization",
  "name_fr": null,
  "description": "English description",
  "description_fr": null,
  "region": { "id": 1, "slug": "ottawa", "name": "Ottawa" },
  "address": "123 Example Street, Ottawa, ON",
  "coordinates": { "latitude": 45.42, "longitude": -75.69 },
  "website": "https://example.org",
  "contact": { "email": null, "phone": null },
  "hours": null,
  "categories": ["Community Organisations"],
  "tags": [],
  "updated_at": "2026-11-18T15:00:00.000Z"
}
```

`hours` is either `null` or an object keyed by weekday names in English
(`monday` through `sunday`). Each provided day maps to an array of opening
intervals; times use 24-hour `HH:MM` format:

```json
{
  "monday": [{ "opens": "09:00", "closes": "17:00" }],
  "sunday": []
}
```

Omitted days are unknown. An empty array means the organization is closed that
day. `tags` is a list of free-text labels; `categories` contains the existing
curated category names. Tags contain at most 50 non-empty labels, each at most
100 characters. Coordinates are decimal degrees; both are `null` when not
known. The French fields are nullable and are not automatically translated.

### Event

```json
{
  "id": 18,
  "title": "Community gathering",
  "title_fr": null,
  "description": "Event details",
  "description_fr": null,
  "region": { "id": 1, "slug": "ottawa", "name": "Ottawa" },
  "start_date": "2026-12-01",
  "start_time": "18:30:00",
  "location": "123 Example Street",
  "location_id": 42,
  "city": "Ottawa",
  "website": "https://example.org/event",
  "tags": [],
  "updated_at": "2026-11-18T15:00:00.000Z"
}
```

`location_id` links an event to an organization when available. It is `null`
when the event is not linked. Dates are ISO `YYYY-MM-DD`; times are local
venue times and can be `null`.

### CSV format

CSV uses UTF-8, a header row, CRLF line endings, and standard double-quote
escaping. Arrays and objects (including `hours`, `categories`, and `tags`) are
encoded as JSON within their cell. Blank cells represent null values. Text
cells beginning with spreadsheet formula characters are prefixed with an
apostrophe to prevent spreadsheet formula execution.

## Updates and synchronization

Organization, event, and region records include `updated_at`. Updates made
through PrideMap's existing editing and approval workflows update that field.
API responses include an `ETag` and `Cache-Control: public, max-age=60`; clients
can send `If-None-Match` on later requests and reuse a cached response on `304
Not Modified`. To refresh, poll the same URL periodically. Use region filters
to limit data to a chapter's area.

There is no webhook or incremental change feed yet. Clients that need a full
mirror should refresh the endpoint and replace their local snapshot; a future
delta feed should include deletion markers before partners rely on incremental
sync.

## Updating listing data

The versioned API is read-only. Existing authenticated write endpoints remain
the way to submit and manage records:

- `POST /api/submissions` and `PUT /api/submissions/:id` accept public
  organization contact details, hours, and tags for review.
- `PUT /api/locations/:id` (and the admin-only `POST /api/locations`) accepts
  `contact_email`, `contact_phone`, `hours`, and `tags`.
- `POST` / `PUT /api/events` accepts event `tags`.

Contact email and phone may be `null`. `hours` must be `null` or a JSON object
using the weekday/interval format above. `tags` must be an array of strings.
These writes require the existing account and region permissions; partner
integrations should use the read endpoints and do not receive write access.

## Errors and limits

Errors use JSON objects with a stable `code`, for example
`{ "code": "INVALID_PAGINATION" }`.

| Status | Example codes | Meaning |
|---|---|---|
| `400` | `INVALID_REGION`, `INVALID_PAGINATION`, `INVALID_UPCOMING_FILTER` | Invalid query parameter |
| `404` | `REGION_NOT_FOUND` | Unknown region slug |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server or database error |

The API is public and read-only. It is not currently API-key protected or
rate-limited separately from the hosting infrastructure; integrations should
cache responses and avoid high-frequency polling.
