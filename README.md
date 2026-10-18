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
  
## Accounts and Submissions

Uploading anything requires an account. Anyone can sign up from the sign-in
page (username, email, password); registration is rate limited per IP.

- **Locations:** signed-in users suggest a business from **Submit a Business**
  (`/create-location`). Submissions land in a pending queue (rate limited per
  account); admins approve or reject them from the dashboard. An approved
  submission becomes a live location owned by the submitter, who can then edit
  or delete it from **My locations & events**.
- **Events:** signed-in users create and manage their own events directly, and
  can link them only to locations they own.
- **Passwords:** password changes (including "forgot password") are requests
  that an admin must approve. Approving one signs that account out everywhere.
- **Admins** see and manage all content, plus a **Users** tab to view
  accounts, delete them (optionally with their locations and events), and
  approve or deny password change requests. Create admins with
  `./add-user.sh <username> [email]`.

## Updating an existing server

After pulling new code, run:

```
./update.sh --check    # optional dry run: applies the migrations, then rolls back
./update.sh            # back up, migrate, install dependencies, build the client
./update.sh --restart  # same, then restart onto the new code via run-servers.sh
```

It takes a `pg_dump` backup to `backups/pre-update_<timestamp>.dump` first,
applies every migration in one transaction, and checks that no rows were lost.
To undo the database change: `./update.sh --rollback backups/pre-update_<timestamp>.dump`.

To bring an existing database up to date for French content, event links, and
image uploads, run the migrations in this order:

```
psql -U pridemap -d pridemap -f server/add-french-location-content.sql
psql -U pridemap -d pridemap -f server/add-events-table.sql
psql -U pridemap -d pridemap -f server/add-french-event-content.sql
psql -U pridemap -d pridemap -f server/add-image-columns.sql
psql -U pridemap -d pridemap -f server/add-image-blob-columns.sql
```

Existing names and descriptions remain the English content; French fields are
optional and the website falls back to English when a French translation is
not available. `setup-db.sh` applies these migrations automatically and checks
that the required columns exist before reporting success.

## Initial Release Plans
- Now hosting initial map with client data
- Next significant release will include CRUD using an SQL database
