# PrideMap! - Now Hosting on http://3.135.26.170/

By: Luke Boyle and Emma Power

## Objectives
- Create an interactive map that displays LGBTQ+ services in Ottawa

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
