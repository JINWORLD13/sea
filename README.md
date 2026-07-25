# Language Selection / 언어 선택 / 言語選択

Welcome! Please select your preferred language to view the documentation:

- **[English](README.md)**
- [한국어](README.ko.md)
- [日本語](README.ja.md)

---

# AI Maritime Monitoring & Digital Twin System

Real-time ship monitoring and digital twin interface inspired by AI autonomous navigation and smart port technology.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r182-black?logo=three.js&logoColor=white)
![Zustand](https://img.shields.io/badge/State_Management-Zustand-orange)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚢 Project Overview

This project is a real-time vessel monitoring interface built on **live global AIS (Automatic Identification System) data** — not mock data. It streams positions from AISStream.io through a Node proxy, computes collision risk (CPA/TCPA) client-side, and renders hundreds of vessels on a Leaflet map plus a Three.js 3D view.

The central engineering problem was **throttling a stream that arrives at hundreds of messages per second down to something a browser can render**, which is solved with a four-layer backpressure pipeline (proxy → stream → store → render).

## 🌟 Key Features

1. **Real-time AIS Map Interface**
   - Custom SVG markers that rotate based on ship heading
   - Vessel trajectory (path) visualization
   - Risk-level colors (safe / warning / danger) and geofencing (restricted zone) highlight

2. **3D Vessel View**
   - 3D ship rendering using Three.js and React Three Fiber
   - Heading and speed from live AIS, smoothed with Lerp interpolation
   - Note: AIS carries no pitch/roll telemetry, so the 3D view reflects only what is actually received

3. **Collision Risk (CPA/TCPA)**
   - Closest Point of Approach distance and time between vessels
   - Auto risk level (500m danger, 1500m warning); fleet scan every 2 seconds

4. **Geofencing**
   - Automatic alert when a vessel enters Busan restricted waters

5. **Operation Modes**
   - Fleet / Safety / Marina mode switching

6. **High-Performance State Management**
   - Zustand with selector-based subscriptions and copy-on-write updates
   - 1s batched flushes; per-view snapshot throttling (800–1200ms) with `startTransition`
   - Viewport culling → 250-marker cap → pixel-grid clustering below zoom 12
   - Marker motion interpolated by a single shared rAF ticker, with zero React re-renders

7. **Global Support**
   - Multi-language (Korean, English, Japanese) with i18next and browser language detection

## 🛠 Tech Stack

- **Framework**: React 19, TypeScript 5.9, Vite 7
- **State Management**: Zustand 5 (selector-based subscriptions)
- **Visualization**:
  - **Map**: Leaflet, React-Leaflet
  - **3D**: Three.js, @react-three/fiber, @react-three/drei
- **Backend (proxy)**: Node.js, Express 5, `ws` — hides the API key, normalizes AIS fields, caches, rate-limits
- **Styling**: Tailwind CSS, Lucide React
- **Data source**: AISStream.io (live global AIS over WebSocket)
- **i18n**: i18next (Korean, English, Japanese)

## 📂 Project Structure

```text
seatrace/
├── server/
│   └── proxy.js          # AIS proxy: key hiding, normalization, cache, rate limiting
├── src/
│   ├── store/
│   │   ├── aisStream.ts  # WebSocket client, batching, reconnect, subscriptions
│   │   ├── useShipStore.ts # Zustand store + CPA/geofence risk pass
│   │   ├── shipTypes.ts  # Domain types
│   │   ├── config.ts     # Tuning constants (all in one place)
│   │   └── persistence.ts # localStorage warm cache, settings, fleet
│   ├── components/
│   │   ├── 3d/           # Three.js / React Three Fiber (Ship, Scene)
│   │   ├── dashboard/    # ModeSwitcher, StatsBar, Alerts
│   │   ├── layout/       # App layout, Sidebar, Header
│   │   └── map/          # Leaflet map, markers, clustering, rAF interpolation
│   ├── hooks/
│   │   └── useShipSnapshot.ts # Render throttling hook
│   ├── utils/            # Maritime math (CPA, latLngToXY, cogSogToVelocity)
│   ├── constants/        # Translations (i18n)
│   ├── i18n.ts           # i18next setup and language detection
│   └── pages/            # Dashboard, LiveMap, FleetStatus, Analytics, Settings
├── public/
└── .env                  # AISSTREAM_API_KEY (server-side only, git-ignored)
```

## 🚀 Getting Started

1. Clone the repository

   ```bash
   git clone https://github.com/JINWORLD13/sea.git
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables (.env)

   ```
   AISSTREAM_API_KEY=your_api_key_here
   PROXY_PORT=8081
   ```

   > Use `AISSTREAM_API_KEY`, **not** `VITE_AISSTREAM_API_KEY`. Vite inlines any
   > `VITE_`-prefixed variable into the client bundle, which would expose the key
   > to anyone who opens devtools. Only the proxy process needs it.

4. Run the frontend and proxy together
   ```bash
   npm run dev
   ```

### Data flow

**Frontend ↔ Proxy server ↔ AISStream** — WebSocket bidirectional. The frontend sends subscription requests (e.g. BoundingBoxes) to the proxy; the proxy forwards them to AISStream; AIS data streams back AISStream → proxy → frontend.

### Security (API keys)

All use of the AIS API key is over secure channels only:

- **Server → AISStream**: The proxy sends the API key to AISStream only over **WSS** (`wss://stream.aisstream.io/v0/stream`). The server refuses to start if the AIS URL is not `wss://`.
- **Browser → Proxy**: The frontend uses **wss://** when the page is loaded over HTTPS (and **ws://** only for local development over HTTP). For production, serve the app over HTTPS so the WebSocket to the proxy uses WSS. The API key is never sent from the browser; it stays on the server.

## 💡 Technical Challenges & Solutions

### 1. Handling High-Frequency WebSocket Data

- **Problem**: Map marker flickering and performance degradation when receiving large AIS data streams (potentially hundreds of vessels).
- **Solution** — a four-layer backpressure pipeline, each layer absorbing a different kind of load:
  - **Proxy (`server/proxy.js`)**: enforces a subscription box area cap (≤ 0.25 sq deg), a per-client budget of 180 msg/s and 600 tracked MMSIs, and serves an instant snapshot from a 5,000-entry server cache in 100-ship chunks.
  - **Stream (`aisStream.ts`)**: coalesces reports into a `Map` keyed by MMSI and flushes once per second, so repeated reports for the same vessel collapse into one store write.
  - **Store (`useShipStore.ts`)**: caps tracking at 500 vessels, prunes anything unheard for 20 minutes, and computes the CPA/geofence pass in a single copy-on-write sweep — one clone and one subscriber notification instead of one per vessel.
  - **Render (`useShipSnapshot.ts` + `map/`)**: throttles each view to its own 800–1200ms snapshot inside `startTransition`, culls off-screen vessels, caps rendered markers at 250, and clusters on a 64px pixel grid below zoom 12.

### 2. Smooth Marker Motion Without Re-rendering

- **Problem**: AIS position reports arrive at irregular multi-second intervals, so markers teleport. Interpolating through React state would mean 60fps × 250 markers of re-render work.
- **Solution**:
  - **Shared rAF ticker** (`markerAnimation.ts`): every marker shares one `requestAnimationFrame` loop that drives `layer.setLatLng()` directly on the Leaflet layer — **zero React re-renders**. The ticker stops itself when no tween is active.
  - **Snap on discontinuity**: jumps over 500m (signal loss and recovery) skip interpolation so vessels never appear to slide across the sea.
  - **Degrade under load**: interpolation is disabled below zoom 11 or above 150 rendered markers, and `prefers-reduced-motion` is respected.
  - **Maritime Math**: utilities convert COG (Course Over Ground) and SOG (Speed Over Ground) into velocity vectors, used for both dead reckoning and CPA computation.

### 3. Ghost Sockets Under React StrictMode

- **Problem**: StrictMode's double-invoked effects left superseded sockets alive. Their `onmessage` handlers kept writing to the store and their reconnect timers kept firing, causing duplicated data and a reconnect storm.
- **Solution** — a **generation counter** (`aisStream.ts`):
  - `startAisStream`/`stopAisStream` bump `streamGeneration` *first*, then capture the value; every callback returns early unless its captured generation is still current, so all superseded callbacks become no-ops.
  - `onclose` uses the same check to distinguish an intentional teardown from an unexpected drop — only the latter schedules a reconnect.
  - Ordering matters in teardown: pending batches are flushed and the local cache is persisted **before** `activeBounds` is nulled, because the cache filters by bounds.
  - Reconnects use exponential backoff (1s → 30s cap) with ±20% jitter, and the existing vessel list is kept so the map never blanks.

### 4. Map Becomes Slow Under High Live Vessel Volume

- **Problem**: Rendering too many live markers/popups/SVG icons at once made zoom, pan, and click interactions sluggish in global AIS mode.
- **Solution**:
  - **Viewport-based rendering**: Render only vessels inside the current map bounds.
  - **Render cap**: Limit rendered vessels per frame (`MAX_RENDERED_SHIPS`) and prioritize ships near the current focus.
  - **Icon cache optimization**: Cache `DivIcon` instances to reduce icon regeneration overhead while preserving real heading rotation.
  - **Auto-focus behavior tuning**: Keep one-time initial fit (`fitBounds`), but skip forced recenter during manual focus/selection flows.

### 5. Vessels That Have No Information Yet

- **Problem**: AIS splits position reports (every few seconds) from static/voyage reports (every 5–6 minutes), and the two can arrive in either order. A vessel that just entered the viewport has coordinates but no name, IMO, or destination.
- **Solution**:
  - Static data arriving before any position is stashed per-MMSI (bounded at 300 entries, oldest evicted) and merged the moment a position shows up.
  - Merge semantics are asymmetric on purpose: **static fields only add information and never erase with `null`**, since different report types legitimately omit fields. Dynamic fields like COG and heading *do* accept an explicit `null` so stale values never linger on screen.
  - A vessel is never created from static-only data, which prevents phantom markers at (0, 0).
  - Unknown values are displayed as unknown rather than filled with plausible-looking defaults.

## ⚠️ Known Limitations

These are deliberate, and worth stating plainly:

- **AIS carries no pitch/roll telemetry.** An earlier version animated hull motion in the 3D view; it was removed once it became clear no real data backed it. The 3D view now reflects only heading and speed.
- **Fuel consumption and CO2 estimates were removed** for the same reason — they cannot be derived from AIS, and unfounded numbers on a monitoring dashboard are worse than no numbers.
- **Analytics aggregates the current session only**, not a historical corpus. The UI labels it as such.
- **The server cache is in-memory**, so it is lost when the proxy restarts. Scaling to multiple instances would need an external store such as Redis.

## 🚀 Future Roadmap

- [ ] Integration with a historical AIS database for playback
- [ ] Persist the proxy cache to an external store for multi-instance deployment
