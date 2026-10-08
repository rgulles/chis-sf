# CHIS-SF

CHIS-SF is a City Heritage Interactive System for the City of San Fernando, Pampanga. It helps visitors explore heritage sites, events, maps, itineraries, and verified heritage visits while giving administrators tools to manage tourism content.

## Features

- Heritage catalogue and detailed site pages with descriptions, history, images, and timelines
- Interactive San Fernando heritage map
- Events
- Recommended itineraries
- Custom itinerary builder
- Visitor login and registration
- Google login (requires OAuth configuration)
- Heritage Passport with visit dates, stamps, and total points
- Location-based visit verification using geofencing
- 100 points for the first verified visit per heritage site; repeat visits earn no additional points
- Admin dashboard
- Heritage, image, timeline, event, itinerary, traveler, and visit-verification management
- Error handling and retry states
- Read Aloud / Listen for real heritage descriptions and history using the browser Web Speech API

Visit verification requires a signed-in visitor and an active site with verification enabled:

**Open Heritage Site → Verify My Visit → Allow Location → Backend Geofence Check → +100 Points → Passport Stamp**

Each heritage site uses its own stored latitude/longitude and an administrator-configurable radius. The backend calculates Haversine distance and checks reported GPS accuracy. Exact visitor coordinates are not stored. Location verification requires HTTPS in production; localhost can be used for development. Browser-reported location is not fraud-proof against GPS spoofing.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet
- **Backend:** Laravel 13, PHP 8.3+, Laravel Sanctum
- **Database:** MySQL / Laravel Eloquent (the example environment defaults to SQLite)

## Project Structure

```text
chis-sf/
├── frontend/
├── backend/
└── README.md
```

## Local Setup

Install PHP 8.3+, Composer, a Node.js version supported by Vite 8, npm, and MySQL.

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Set `DB_CONNECTION=mysql` and configure `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env`. Create the database, then run:

```bash
php artisan migrate
php artisan storage:link
php artisan serve
```

The API runs at `http://127.0.0.1:8000`. Migrations create the schema; heritage content is managed through Admin or the documented [heritage import process](backend/database/data/README.md).

### Frontend

In another terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The development server proxies `/api` and `/storage` to the backend. Set `VITE_API_BASE_URL` in `frontend/.env` if the backend runs at a different address.

For Google login, set the same OAuth client ID as `VITE_GOOGLE_CLIENT_ID` in `frontend/.env` and `GOOGLE_CLIENT_ID` in `backend/.env`, and allow the frontend origin in the Google OAuth configuration. Read Aloud requires browser Web Speech API support and no external audio API.
