# Naval Intelligence Platform — Project Documentation

**CPSC 597 Senior Capstone | California State University, Fullerton | Spring 2026**
**Advisor:** Dr. Bin Cong
**Developer:** Ryan Pham

---

## What This Is

A real-time maritime domain awareness web application — the kind of platform defense contractors use to monitor vessel traffic, detect anomalies, and understand the operational picture at sea. Commercially, platforms like MarineTraffic.com do this for the public. This project builds a focused, engineering-rigorous version of that concept from scratch, with a defense-oriented framing and progressively layered intelligence capabilities.

The platform ingests live AIS (Automatic Identification System) transmissions from vessels across North American waters, renders them on an interactive map with rich filtering and clustering, and overlays real oceanographic data from Open-Meteo's marine and atmospheric APIs. It is designed as a portfolio demonstration for roles at defense contractors where full-stack engineering meets geospatial intelligence.

---

## System Architecture

```
Browser (React + Leaflet)
├── Interactive Leaflet map
│     ├── Vessel markers (clustered, SVG arrows, color-coded by category)
│     ├── Wave height overlay (L.circle geographic markers, color by height)
│     └── Wind direction overlay (animated SVG arrow grid, 90 points)
├── Vessel Data Panel (table, search, filter, CSV export)
├── Wave Height Data Panel (table, condition badges, CSV export)
├── Wind Direction Data Panel (table, category badges, CSV export)
└── Sidebar (navigation, weather toggles, data view buttons)
         │
         │  HTTP GET /api/vessels        (polling, every 30s)
         │  HTTP GET /api/weather/data   (lazy, on first overlay toggle)
         ▼
Express API Server (Node.js, port 3001)
├── GET /api/vessels      → snapshot from in-memory vesselMap
└── GET /api/weather/data → Open-Meteo fetch, 1-hour server-side cache
         │
         │  WebSocket (persistent, reconnecting)     HTTPS (on demand, parallel)
         ▼                                           ▼
AISStream.io                              Open-Meteo APIs
wss://stream.aisstream.io/v0/stream       marine-api.open-meteo.com  (wave height)
(live AIS messages, North America bbox)   api.open-meteo.com         (wind speed/dir)
```

### Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 19 (CRA, JavaScript) | Component model maps cleanly to map, panel, sidebar, and overlay concerns. No TypeScript to avoid overhead on an academic timeline. |
| Map rendering | Leaflet + react-leaflet | De facto open-source 2D web mapping library. react-leaflet provides React lifecycle hooks (`useMap`) while allowing raw `L.*` calls where needed. |
| Marker clustering | leaflet.markercluster | 1,200+ simultaneous markers are unusable without clustering. Groups nearby vessels into count bubbles; spiderfies to individuals at zoom 12+. |
| Backend | Node.js + Express | Event-loop I/O handles a long-lived WebSocket client alongside concurrent HTTP requests cleanly. Same language as the frontend reduces context switching. |
| AIS ingestion | ws (WebSocket client) | Direct, low-overhead WebSocket library for connecting to AISStream.io. No socket.io ceremony needed for a single third-party stream. |
| Weather data | Open-Meteo (marine + atmospheric APIs) | Free, no API key, multi-location batch requests, ~2s response time. Marine API covers wave height; atmospheric API covers wind. Returns all points in a single HTTPS request each. |
| Environment config | dotenv | AIS API key lives in `server/.env`, never touches the client bundle or version control. |

---

## Data Sources

### 1. AISStream.io — Live Vessel Tracking
AIS (Automatic Identification System) is a maritime safety protocol: every commercial vessel over 300 gross tons is legally required to broadcast its identity, position, speed, and heading via VHF radio every few seconds. AISStream.io aggregates these broadcasts globally from a network of terrestrial and satellite receivers and delivers them as normalized JSON over WebSocket.

The server subscribes to a North American bounding box (`[[24, -130], [50, -60]]`) and two message types:
- **PositionReport** — latitude, longitude, speed over ground (SOG), course over ground (COG), true heading, navigational status
- **ShipStaticData** — ship name, IMO number, call sign, ship type code, destination

These two message types arrive independently and are merged by MMSI into a single in-memory record per vessel.

### 2. Open-Meteo Marine API — Wave Height
Open-Meteo's marine API delivers current and forecast wave data derived from global ocean wave models (equivalent to NOAA's WaveWatch III output). The server queries 20 confirmed ocean waypoints distributed across the North American maritime zone and receives significant wave height and swell direction for each point in a single batched HTTPS request. No API key required.

Wave height is classified into six conditions: Calm (< 0.5 m), Light (< 1.5 m), Moderate (< 2.5 m), Rough (< 3.5 m), Very Rough (< 5.0 m), and Dangerous (≥ 5.0 m) — each mapped to a distinct color on the overlay.

### 3. Open-Meteo Atmospheric API — Wind Speed and Direction
Open-Meteo's standard forecast API covers all locations (land and sea) and returns current 10-meter wind speed and direction. The server queries a 5°×5° grid of 90 points covering the full AIS bounding box (lat 25–50, lon -130 to -60). All 90 points are batched into a single request alongside the wave query. The two fetches run in parallel with `Promise.allSettled`, so either can fail independently without blocking the other.

---

## Milestone 1: Core Vessel Tracking Platform

**Status: Complete**

### Features Delivered

**Real-time AIS ingestion**
The server connects to AISStream.io on startup and maintains a persistent, self-reconnecting WebSocket connection. Incoming messages are parsed and merged into an in-memory `Map<MMSI, VesselRecord>`. The merge strategy (`{ ...existing, ...newFields }`) ensures that position data from PositionReport messages and static data from ShipStaticData messages coexist in the same record regardless of arrival order.

**Vessel map with clustering**
An interactive Leaflet map with dark/light CartoDB basemap themes. Up to 1,400 active vessels are rendered as clustered, color-coded SVG directional arrows. Cluster groups break apart at zoom level 12, showing individual vessels. Clicking any vessel opens a popup with full identity and motion data.

**Directional vessel markers**
Each marker is a rotated SVG triangle indicating the vessel's heading. True heading is preferred when available (AIS value < 511); otherwise, course over ground is used as a fallback — this handles the common case where heading sensor data is unavailable or unreported. Marker color encodes vessel category (cargo = blue, tanker = red, passenger = purple, fishing = green, military = gray, etc.).

**Ship category classification**
AIS ShipStaticData includes a numeric `shipType` code. A lookup function maps these codes to human-readable categories (Cargo, Tanker, Passenger, Fishing, Military, etc.) following the ITU-R M.1371 AIS standard.

**Vessel Data Panel**
A modal table showing all currently tracked vessels with columns for MMSI, ship name, type, call sign, coordinates, speed, course, heading, destination, and last update. Includes a CSV export that downloads the current filtered view.

**30-second auto-refresh**
The map polls `/api/vessels` every 30 seconds. Instead of clearing and redrawing all markers each cycle, the layer diffs incoming MMSI sets against existing markers: markers for departed vessels are removed, existing markers are updated in-place (position, icon, popup content), and new markers are added. This prevents flickering and preserves open popup state.

**Stale vessel cleanup**
Vessel records older than 5 minutes (by `lastUpdated` timestamp) are purged from memory every 60 seconds. This keeps the in-memory map bounded and ensures the map reflects the current operational picture rather than accumulating ghost tracks.

**Sidebar + theme toggle**
A hamburger-triggered 260px sidebar for navigation. A floating button toggles between CartoDB Dark Matter (default) and CartoDB Voyager (light) basemaps.

### Key Architecture Decision: No Database
Vessel state is entirely in-memory and resets on server restart. This is intentional. Maritime positions are time-critical — a vessel's position from 10 minutes ago may be actively misleading in a surveillance context. The 5-minute TTL enforces data recency as a first-class constraint. Adding a database would introduce schema migrations, connection management, storage costs, and query complexity without improving the core live-map use case. If historical track storage becomes a requirement in a future milestone, PostgreSQL with PostGIS would be the right addition.

---

## Milestone 2: Weather Overlays and Vessel Filtering

**Status: Complete**

### Features Delivered

**Wave height overlay (toggleable, interactive)**
Color-coded geographic circles rendered with Leaflet's `L.circle` at 800 km radius per point, covering the 20 ocean waypoints. Circles overlap and blend, producing a continuous heatmap-like effect that scales correctly with zoom. Six colors from sky-blue (calm) to red (dangerous) match a labeled condition scale. Each circle is hoverable — mousing over any zone shows a tooltip with the exact wave height in meters, the condition label (e.g., "Moderate"), and the swell direction in degrees with compass bearing (e.g., "292° (WNW)").

**Wind direction overlay (toggleable, animated)**
Rotated SVG arrow markers at 90 grid points across a 5°×5° lattice spanning the full AIS bounding box. Arrow color encodes wind speed: green (≤ 8 m/s), orange (8–15 m/s), red (> 15 m/s). Each arrow pulses with a staggered CSS animation (`animation-delay` driven by a per-marker CSS custom property `--delay`) so the layer reads as a live, flowing field rather than static icons. Hovering any arrow shows wind direction in degrees and speed in m/s.

**Weather data panels (View Wave Height / View Wind Direction)**
Two new modal data panels accessible from the sidebar, styled to match the Vessel Data Panel. Each fetches `/api/weather/data` and displays a full table:
- Wave Height panel: Latitude, Longitude, Wave Height (m), Swell From (degrees + compass), Condition (color-coded badge)
- Wind Direction panel: Latitude, Longitude, Wind Speed (m/s), Wind From (degrees + compass), Category (color-coded badge — Calm / Light / Moderate / Strong / Gale)

Both panels include a CSV download. Buttons are disabled until weather data has been loaded (sidebar shows a pulsing "Fetching weather data..." status during the initial fetch).

**Vessel search and filtering**
The Vessel Data Panel now includes a persistent filter bar:
- **Text search** — filters by ship name, MMSI, or call sign (case-insensitive, partial match)
- **Type dropdown** — filters by derived vessel category (populated dynamically from the loaded vessel set)
- **Result counter** — shows matched / total when a filter is active
- **Clear button** — resets all filters with one click

The CSV download exports the filtered view, not the full dataset.

**Sidebar weather section**
The sidebar has two labeled sections: "Vessel Data" and "Weather Overlays." The Weather Overlays section contains "View Wave Height" and "View Wind Direction" data panel buttons (above the toggles), followed by the map layer toggle buttons. Each toggle shows an "ON" badge when active and a blue inset-border highlight. Data view buttons are disabled until the weather fetch completes.

### On the Weather API — What Was Evaluated and Why Open-Meteo Was Used

The milestone specification referenced the "NOAA Marine Weather API." Three NOAA options were evaluated and ruled out before settling on Open-Meteo.

**`api.weather.gov` (NWS Forecast API)** — designed for point-based forecast queries. No bulk endpoint; covering the AIS bounding box would require hundreds of individual lat/lon requests per refresh. Open-ocean points frequently return errors because NWS coverage is built around Weather Forecast Offices, which don't extend far offshore.

**NOAA ERDDAP WMS (WaveWatch III tiles)** — investigated as a tile overlay. The ERDDAP endpoint at `coastwatch.pfeg.noaa.gov` now returns HTTP 302 to PacIOOS, which then returns HTTP 404. The service is effectively dead for programmatic use.

**NOAA NDBC (buoy observation files)** — fetching individual text files for 50 buoy stations takes 15–30 seconds due to sequential DNS + TCP + HTTP overhead per station, even with parallelism. The first-load latency made the feature feel broken to the user before any data arrived.

**Open-Meteo** was selected because it accepts multi-location batch requests (comma-separated lat/lon arrays), returns all points in a single HTTPS response in approximately 2 seconds, requires no API key, and covers both ocean (marine API) and land (atmospheric API) without gaps. The marine API specifically provides significant wave height and swell direction from the same global wave model family as WaveWatch III.

### Key Architecture Decision: L.circle Instead of a Heatmap Library
The wave height layer was initially prototyped with `leaflet.heat` (a canvas-based kernel density heatmap). The heatmap library renders into a viewport-sized canvas element positioned at the map's top-left corner. With the map centered over the Atlantic at zoom 3, all 20 North American ocean points appear in the leftmost quarter of the visible screen — the heatmap blobs were clipped at the canvas boundary, producing a quarter-circle artifact rather than a full ocean overlay.

`L.circle` with a geographic radius (800 km) solves this correctly: Leaflet projects and draws each circle relative to its actual lat/lon anchor, regardless of where it appears on screen. Circles scale naturally with zoom, overlap to blend colors, and are properly clipped at the world boundary. The result is visually indistinguishable from a heatmap at typical zoom levels and avoids the canvas-clipping class of bugs entirely.

### Key Architecture Decision: Server-Side Weather Proxy with 1-Hour Cache
Weather data is fetched server-side and cached for one hour, rather than having the browser call Open-Meteo directly. This means multiple users share a single cached fetch, and CORS headers are never a concern (server-to-server requests don't have CORS restrictions). Weather state at sea changes on the order of hours, not minutes, so a 1-hour cache doesn't meaningfully degrade data quality while eliminating redundant upstream requests.

The fetch is also lazy on the client: `WeatherLayer` tracks whether a fetch has fired using a `useRef` guard and only requests data the first time a weather toggle is turned on, not on mount. Users who never open a weather overlay never trigger the fetch.

---

## Milestone 3: System Health and Live Monitoring

**Status: Complete**

### Features Delivered

**System Information panel**
A modal panel accessible from the sidebar ("System Information" button under Vessel Data) that gives a real-time operational picture of all backend services. Polls `GET /api/system/health` every 5 seconds and displays three sections:

- **API Status cards** — one card per service (AIS Stream, Weather API). Each card shows a colored status dot (green = connected/ready, pulsing yellow = connecting/reconnecting, red = disconnected/error), a plain-English status label, and key stats (vessel count, message count, last fetch time, data point counts).
- **Live vessel count by category** — horizontal bar chart sorted by count, colored to match the map markers (Cargo = blue, Tanker = red, Passenger = purple, etc.). Updates every poll cycle as vessels arrive, depart, or are reclassified.
- **Live log feed** — a scrollable, newest-first feed of log entries from both the AIS and weather services. Entries are color-coded by source (AIS = blue, Weather = green) and level (warn = yellow, error = red). The feed holds the last 150 entries in a server-side circular buffer and auto-scrolls when new entries arrive.

**Shared server-side log buffer**
A new `logger.js` service provides a `pushLog(source, level, message)` function that appends timestamped entries to a 150-entry circular buffer. Both `aisstream.js` and `weather.js` call `pushLog` on all meaningful events: connection open/close/error, first data received, stale vessel cleanup, periodic stats, weather fetch start/success/error, and cache writes. This gives the System Information panel a live narrative of server activity without requiring a logging framework or persistent storage.

**`GET /api/system/health` endpoint**
Returns a single JSON snapshot containing:
- AIS connection status, positioned vessel count, total message count, and vessel counts grouped by category
- Weather fetch status, last fetch timestamp, and cached point counts for wave and wind data
- The full log buffer (up to 150 entries)

### Key Architecture Decision: In-Process Circular Buffer Instead of a Logging Framework
A proper production system would route logs through a structured logging library (Winston, Pino) to a log aggregation service (Datadog, Splunk, CloudWatch). For this platform, that would be significant infrastructure overhead — API keys, agents, billing, and a separate service to maintain — for a feature whose purpose is to demonstrate live observability, not to provide production-grade log retention.

The in-memory circular buffer gives the same user-facing result (a live, scrolling log feed visible in the UI) with a single 12-line module. The tradeoff is that logs reset on server restart and are not queryable. That tradeoff is acceptable for the academic context and makes the implementation auditable without external dependencies.

---

## Milestone 4 and Beyond

*To be documented as development continues.*

---

## Running the Project

**Prerequisites:** Node.js 18+, an AISStream.io API key in `server/.env`

```bash
# Backend
cd server
npm install
npm run dev          # nodemon, port 3001

# Frontend (separate terminal)
cd client
npm install
npm start            # CRA dev server, port 3000
```

The client proxies all `/api` requests to `localhost:3001` via CRA's built-in proxy configuration.

---

## File Structure

```
597-capstone/
├── server/
│   ├── server.js                        # Express bootstrap, CORS, route mounting
│   ├── src/
│   │   ├── routes/
│   │   │   ├── vesselRoutes.js          # GET /api/vessels
│   │   │   ├── weatherRoutes.js         # GET /api/weather/data
│   │   │   └── systemRoutes.js          # GET /api/system/health
│   │   └── services/
│   │       ├── aisstream.js             # AISStream WebSocket + vesselMap + cleanup + status exports
│   │       ├── weather.js               # Open-Meteo fetch + 1-hour cache + status export
│   │       └── logger.js                # 150-entry circular log buffer (pushLog / getLogs)
│   └── .env                             # AISSTREAM_API_KEY (not in version control)
│
└── client/
    └── src/
        ├── App.js                       # Root layout, sidebar/panel state, weather toggles
        ├── components/
        │   ├── Map.js                   # MapContainer, theme toggle, WeatherLayer wiring
        │   ├── VesselLayer.js           # Polls /api/vessels, manages marker cluster
        │   ├── WeatherLayer.js          # L.circle wave overlay + animated wind arrows
        │   ├── VesselDataPanel.js       # Vessel table with search, filter, CSV export
        │   ├── WeatherDataPanel.js      # Wave/wind data table with condition badges, CSV export
        │   ├── SystemInfoPanel.js       # API status cards, category bars, live log feed
        │   └── Sidebar.js              # Navigation, weather toggles, data view buttons
        └── [component].css              # Per-component styles, consistent dark theme
```
