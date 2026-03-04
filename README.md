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
  
## Initial Release Plans
- Now hosting initial map with client data
- Next significant release will include CRUD using an SQL database
