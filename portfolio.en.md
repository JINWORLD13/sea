# SEATRACE — Real-time AIS Vessel Tracking

> Solo personal project · Live global AIS stream → vessel tracking and collision-risk assessment in the browser
> 🔗 **[vts-tau-navy.vercel.app](https://vts-tau-navy.vercel.app)** · 📦 **[github.com/JINWORLD13/sea](https://github.com/JINWORLD13/sea)**

---

## In one sentence

The core engineering problem was **throttling a live AIS WebSocket stream that arrives at hundreds of messages per second down to something a browser can actually render.** I solved it with four layers of backpressure — proxy, stream, store, and render — each absorbing a different kind of load.

---

## Overview

|  |  |
|---|---|
| **Project** | SEATRACE — Real-time AIS Vessel Tracking |
| **Scope / team** | Solo (product, frontend, proxy server, maritime algorithms) |
| **Data source** | [AISStream.io](https://aisstream.io) — live global AIS over WebSocket (**not mock data**) |
| **Size** | ~9,000 lines TypeScript/TSX + ~1,100 lines Node proxy |
| **Screens** | Dashboard · Live Map · Fleet Status · Analytics · Settings |

### Why I built it

I wanted to find out what actually breaks when you handle **real** real-time data. A dashboard built on mock data always looks good; it just never teaches you anything. The problems only show up the moment you attach a live stream — hundreds of messages per second, irregular gaps, sockets that drop, and the frame drops that come from several hundred markers on a map.

My background is relevant here: I sailed as a deck officer, so I had watched ARPA and ECDIS screens compute exactly this kind of thing. That is why the governing design rule from day one was to **separate what AIS actually broadcasts from what I would be inventing to make the screen look good.** On a monitoring console, mixing those two is not a feature — it is a source of misjudgment.

---

## Tech stack

| Area | Stack |
|---|---|
| **Frontend** | React 19, TypeScript 5.9, Vite 7 |
| **State** | Zustand 5 (selector-based subscriptions) |
| **Map** | Leaflet 1.9, React-Leaflet 5 |
| **3D** | Three.js, @react-three/fiber, @react-three/drei |
| **Backend (proxy)** | Node.js, Express 5, `ws` |
| **Styling** | Tailwind CSS 3, Lucide React |
| **i18n** | i18next (Korean · English · Japanese) |

---

## 🔑 The core: a four-layer backpressure pipeline

This is the part I can defend in the most depth. Between the raw AIS stream and the screen sit four attenuation stages, each responsible for a different kind of load.

```
Raw AISStream  ─── hundreds of msg/s in a busy strait ──┐
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────┐
 │ ① Proxy server (server/proxy.js)                                       │
 │   · Enforces subscription box area <= 0.25 sq deg                      │
 │   · Per-client caps: 180 msg/s, 600 tracked MMSIs                      │
 │   · Server LRU cache of 5,000 vessels (10-min TTL) → instant snapshot  │
 │   · Snapshot split into 100-ship chunks → no single huge frame         │
 └──────────────────────────────────────────────────────┬─────────────────┘
                                                        │ <= 180 msg/s per client
 ┌──────────────────────────────────────────────────────▼─────────────────┐
 │ ② Stream layer (src/store/aisStream.ts)                                │
 │   · Coalesces reports into a Map keyed by MMSI → repeated reports for  │
 │     the same vessel collapse into one store write                      │
 │   · Flushes once per second (first batch immediate, for a fast start)  │
 │   · Positions outside the subscription box are dropped before the store│
 └──────────────────────────────────────────────────────┬─────────────────┘
                                                        │ <= 1 set() per second
 ┌──────────────────────────────────────────────────────▼─────────────────┐
 │ ③ Store layer (src/store/useShipStore.ts)                              │
 │   · Caps tracking at 500 vessels, prunes anything unheard for 20 min   │
 │   · CPA + geofence in a single copy-on-write pass (see below)          │
 └──────────────────────────────────────────────────────┬─────────────────┘
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────┐
 │ ④ Render layer (useShipSnapshot.ts + components/map/)                  │
 │   · Per-view 700–1,200 ms snapshot throttle inside startTransition     │
 │   · Viewport culling → 250-marker render cap (nearest-to-focus first)  │
 │   · Pixel-grid clustering (64 px) below zoom 12                        │
 │   · Marker motion via one shared rAF ticker → zero React re-renders    │
 └──────────────────────────────────────────────────────┬─────────────────┘
                                                        ▼
                                              Screen (frames stay smooth)
```

---

## What AIS gives you — and what it does not

This is the part I spent the most time getting right. AIS is not omniscient, and not every value on screen is measured.

| Value | Provided by AIS? | How this project handles it |
|---|---|---|
| Latitude / longitude | Yes (Msg 1/2/3) | Used directly (measured) |
| SOG (speed over ground) | Yes, 0.1 kn resolution | Converted to a velocity vector with COG (measured) |
| COG (course over ground) | Yes, 0.1° resolution | CPA computation + marker rotation (measured) |
| Heading | Yes; 511 when no gyro | Falls back to COG when 511 (measured or derived) |
| Name / type / dimensions / draught | Static message only, ~every 6 min | Merged by MMSI; shown as *unknown* until it arrives |
| **Pitch / Roll** | **Not in AIS at all** | **Not displayed — the synthetic motion was removed** |

> **Pitch and roll do not exist in AIS messages.** An earlier version animated hull motion from a parametric model driven by SOG and rate of turn. I removed it: on a monitoring console, motion with no measurement behind it looks exactly like measured motion, which is the most dangerous kind of UX. The 3D view now reflects only the heading and speed actually received. Real attitude would require an onboard MRU or IMU feed.
>
> Dropping the "digital twin" label was the same decision — I chose to write down what the system cannot do.

---

## Engineering problems and how I solved them

### 1. Receiving a live stream without exposing the API key

**Problem** — AISStream requires the API key in the subscription message sent right after the WebSocket opens. Connecting from the browser would bake the key into the bundle, where anyone can read it from devtools.

**Solution** — I wrote a Node/Express + `ws` proxy ([server/proxy.js](server/proxy.js)).

- The key exists only in the server process; the browser talks solely to the proxy.
- I defined a small wire protocol discriminated by a `t` field (`pos` / `static` / `snapshot` / `snapshotEnd` / `error`).
- AIS sentinel values (SOG 102.3 = unavailable, heading 511 = unavailable, COG ≥ 360 = unavailable) are **normalized to `null` on the server**, so the client never has to know the domain quirks.
- Subscription boxes from multiple clients are unioned, and upstream resubscription is debounced by 2 seconds (max 8 boxes).
- **Client input is treated as hostile**: non-object payloads and out-of-range coordinates are rejected, frames are capped at 64 KB (the `ws` default of 100 MB is an OOM vector), subscription floods are ignored, a 30-second ping/pong heartbeat reaps half-open sockets, and an `ALLOWED_ORIGINS` allowlist can lock the endpoint to the deployed frontend. A last-resort `uncaughtException` handler makes sure one bad frame cannot drop every connected client and the warm cache with it.

**Result** — zero key exposure, and as a side effect all AIS protocol parsing disappeared from the client, which now only ever sees clean JSON.

---

### 2. Changing the subscription as the map moves

**Problem** — Subscribing to the whole world means thousands of messages per second and a frozen browser. Subscribing to one fixed area means an empty screen the moment the user pans away.

**Solution** — viewport-driven resubscription.

- 400 ms debounce after `moveend` / `zoomend`, so a drag does not fire dozens of resubscribes.
- The subscription box is the viewport plus 15% padding, so edges do not go blank while panning.
- If the padded area exceeds the proxy's limit, it falls back to the region box and clusters on the client.
- **The socket is never torn down** — only the subscription message is re-sent, so there is no reconnect delay.
- Vessels outside the new box are pruned from the store immediately (the selected vessel is exempt).

---

### 3. Ghost sockets under React StrictMode

**Problem** — StrictMode double-invokes effects. Sockets I thought were cleaned up stayed alive, their `onmessage` kept writing to the store, and their reconnect timers kept firing — duplicated data and a reconnect storm.

**Solution** — a **generation counter** ([aisStream.ts](src/store/aisStream.ts)).

```ts
let streamGeneration = 0;

export const startAisStream = (bounds: RegionBounds): void => {
  streamGeneration += 1;               // bump first
  const generation = streamGeneration; // then capture
  // ...
};

// every callback checks whether its generation is still current
socket.onmessage = (event) => {
  if (generation !== streamGeneration || activeSocket !== socket) return;
  // ...
};
```

Every callback belonging to a superseded generation becomes a **no-op automatically**. `onclose` uses the same check to tell an intentional teardown apart from an unexpected drop, so only the latter schedules a reconnect.

Teardown **ordering** matters for the same reason: pending batches must be flushed and the cache persisted *before* `activeBounds` is nulled, because the cache filters by bounds.

**Reconnect** — exponential backoff from 1 s to a 30 s cap with ±20% jitter, and the existing vessel list is kept on screen so the map never blanks.

---

### 4. Collision-risk scanning: solving O(n²) by redefining the question

**Problem** — Checking every pair every 2 seconds is n(n−1)/2 pairs; at 500 vessels that is ~125,000 pairs per sweep. Worse, the first implementation updated each vessel individually, and since Zustand's `set` clones the `ships` object every time, that meant **500 full clones and 500 subscriber notifications** per sweep. The UI froze on a 2-second rhythm.

**Solution** — two changes.

**(1) The question a VTS console actually answers is not "risk between all vessels" but "risk relative to the selected own-ship"** — exactly how ARPA computes CPA. That redefines the sweep as O(n): selected vessel against everyone else.

**(2) A single-pass copy-on-write update** ([useShipStore.ts](src/store/useShipStore.ts)):

```ts
let nextShips = state.ships;   // start with the original reference
for (const id of Object.keys(state.ships)) {
  // ... risk computation ...
  if (riskChanged || zoneChanged || alertsChanged) {
    if (nextShips === state.ships) {
      nextShips = { ...state.ships };   // clone exactly once, and only if needed
    }
    nextShips[id] = { ...ship, risk: nextRisk, /* ... */ };
  }
}
return changed ? { ships: nextShips } : {};  // no change → no notification at all
```

**Result** — 500 clones became at most 1, and 500 notifications became at most 1. On a tick with no change, an empty object is returned and **no re-render happens at all**.

**The risk algorithm** — I implemented CPA (Closest Point of Approach) and TCPA directly ([maritimeMath.ts](src/utils/maritimeMath.ts)):

```
r = p2 - p1        relative position (m)
v = v2 - v1        relative velocity (m/s), converted from COG/SOG

TCPA = -(r · v) / (v · v)
CPA  = |r + v * TCPA|
```

Distance alone is not enough. The actual classification also checks:

| Condition | Handling | Why |
|---|---|---|
| TCPA ≤ 0 | Not an alert | The closest point is already past — the vessels are **separating**. Distance alone produces a false alarm here |
| TCPA beyond the horizon | Not an alert | A prediction that far out is invalidated by a single course change |
| Relative velocity ≈ 0 | Use current distance | The squared relative velocity is the denominator, so parallel tracks make TCPA diverge |
| **COG and heading both unknown** | **Treat as stationary** | The proxy honestly nulls COG ≥ 360 and heading 511 (common on Class-B). Defaulting to 0° would model the vessel as steaming due north and fire phantom alerts |
| CPA < 500 m and TCPA < 6 min | danger | Tighter than the operational norm (~0.5–1.0 NM), narrowed so events are observable in a demo; exposed as a tunable constant |
| CPA < 1,500 m and TCPA < 12 min | warning | Same |

---

### 5. Moving hundreds of markers smoothly

**Problem** — AIS position reports arrive at irregular multi-second intervals, so markers teleport. But interpolating through React state would mean 60 fps × 250 markers of re-render work.

**Solution** — **every marker shares a single rAF ticker** that drives the Leaflet layer directly, bypassing React ([markerAnimation.ts](src/components/map/markerAnimation.ts)).

- Exactly one global ticker, which stops itself when no tween is active.
- `layer.setLatLng()` updates the DOM directly → **zero React re-renders**.
- Jumps over 500 m (signal loss and recovery) snap instead of tweening, so vessels never appear to slide across the sea.
- Below zoom 11, or above 150 rendered markers, interpolation is disabled entirely.
- The OS `prefers-reduced-motion` setting is respected.

---

### 6. A blank screen on every refresh

**Problem** — Socket connect → subscribe → first data took 1–2 seconds, during which the map was empty and the app looked broken.

**Solution** — a two-stage warm start.

1. **Client cache** — the last-seen vessels are persisted to localStorage (10-min TTL, 500 vessels) and injected into the store the instant the stream starts ([persistence.ts](src/store/persistence.ts)). Because React effect cleanup does **not** run on page exit, the final write happens on `pagehide`; and an empty ship list never overwrites the cache, so a region switch cannot wipe it.
2. **Server cache** — the proxy keeps three key regions (Busan, Incheon, Singapore Strait) subscribed at all times regardless of whether any client is connected, so a new connection receives a **snapshot in 100-ship chunks immediately**.

---

### 7. Vessels that have no information yet

**Problem** — AIS splits **position reports** (every few seconds) from **static/voyage reports** (every 5–6 minutes), and the two arrive in either order. A vessel that just entered the viewport has coordinates but no name, IMO, or destination.

**Solution**

- Static data arriving before any position is stashed per-MMSI (bounded at 300 entries, oldest evicted) and merged the moment a position shows up.
- Merge semantics are **asymmetric on purpose**: static fields only *add* information and never erase with `null`, since different report types legitimately omit fields. Dynamic fields like COG and heading *do* accept an explicit `null`, so stale values never linger on screen.
- A vessel is **never created from static-only data**, which prevents phantom markers at (0, 0).
- Unknown values are displayed as unknown rather than filled with plausible-looking defaults.

**Why this matters** — on a monitoring system, leaving a gap visible is far safer than filling it with something that looks right.

---

## Other implementation notes

- **i18n** — Korean, English, and Japanese via i18next with browser language detection; all three tables carry identical key sets.
- **Vessel search** — merges the local store with the proxy's `/search` endpoint (over the 5,000-vessel server cache); each request cancels the previous one via `AbortController`.
- **Connection panel** — Settings polls the proxy's `/health` every 15 seconds and displays upstream state, uptime, cache size, and the active limits **verbatim**, with no smoothing.
- **Geofencing** — edge-triggered alerts on entering a restricted area (fires once, on the transition).
- **Alert feed** — deduplicated per MMSI over 5 minutes, capped at 100 entries.
- **Custom markers** — SVG `DivIcon`s colored by vessel type and rotated by real heading, cached in a bounded FIFO to eliminate regeneration cost.
- **Deployment** — frontend on Vercel (with an SPA rewrite so deep links work), proxy on Render with a `/health` health check.

---

## Known limitations

Stated plainly, because they are deliberate:

- **AIS carries no pitch/roll telemetry.** The synthetic hull motion was removed once it was clear no real data backed it.
- **Fuel and CO2 estimates were removed for the same reason.** They cannot be derived from AIS, and unfounded numbers on a monitoring dashboard are worse than no numbers.
- **Analytics aggregates the current session only**, not a historical corpus. The UI labels it as such.
- **The server cache is in-memory**, so it is lost when the proxy restarts. Scaling to multiple instances would need an external store such as Redis.
- **CPA is computed point-to-point.** Real collision risk should account for vessel length and beam; the static message carries those dimensions, which would change the verdict for large vessels.
- **COLREG encounter types are not classified.** Head-on, overtaking, and crossing carry different give-way obligations; adding the rate of change of relative bearing would allow classifying them.

---

## What I took away from it

The biggest lesson was that **"real-time" is a design problem, not a performance problem.** I started out assuming more `React.memo` and `useMemo` would fix it. The actual fix was deciding *at which layer, and by how much, to reduce the data before it ever reaches the screen*. One line capping the proxy at 180 messages per second did more than any amount of memoization in the frontend.

The second was the value of **not inventing data**. Filling gaps with mock values makes the screen look richer, and in that same moment the project stops being a monitoring system and becomes something that merely looks like one. Taking features out is what made it trustworthy.
