# PrideMap! - Now Hosting on http://3.135.26.170/
### An interactive map that displays LGBTQ+ services in Ottawa

By: Luke Boyle and Emma Power

## How To Run
### Dev Server
Ensure npm is installed

Run `npm install` in both the client and server

Run `./run.sh` to run the application. Default dev web server is at http://localhost:5173/

### Production Server
Run `./run-server.sh` on the server. 

This script includes all installations, and nginx proxying. Default server is on port 80, or in other words, no need to specify port in a web browser

## Architecture
Server:
- AWS EC2 Instance
- Node Backend
- Rest API
  
Client:
- React Frontend
- Leaflet and Open Street Maps for the mapping serive
- Connects to rest API via nginx proxy at /api

Database:
- Postgres - Work in Progress
  
## Public Business Submissions

Anyone can suggest a business/service from the **Submit a Business** page
(`/create-location`). Submissions are CAPTCHA-protected (Cloudflare Turnstile),
rate limited to one per IP every 10 minutes, and land in a pending queue. Admins
approve or reject them under **Manage Locations → Pending Submissions**; an
approval copies the entry into the live `locations` table.

### Turnstile (CAPTCHA) setup
Create a Turnstile widget at
<https://dash.cloudflare.com/?to=/:account/turnstile> to get a **site key**
(public) and a **secret key** (private), then:

- **Server:** export `TURNSTILE_SECRET_KEY=<secret>` before starting the Node
  server (e.g. in `run-server.sh` / your process manager).
- **Client:** set `VITE_TURNSTILE_SITE_KEY=<site key>` at build time (e.g. a
  `.env` file in `client/pridemap/`).

If either is unset, the app falls back to Cloudflare's "always passes" **test
keys** so local dev works without configuration — do **not** ship the test keys
to production, as they provide no bot protection.

### Database migration
Existing databases need the new `submissions` table:

```
psql -U pridemap -d pridemap -f server/add-submissions-table.sql
```

## Initial Release Plans
- Now hosting initial map with client data
- Next significant release will include CRUD using an SQL database
