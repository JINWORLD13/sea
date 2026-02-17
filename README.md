# Language Selection / 언어 선택 / 言語選択

Welcome! Please select your preferred language to view the documentation:

- **[English](README.md)**
- [한국어](README.ko.md)
- [日本語](README.ja.md)

---

# AI Maritime Monitoring & Digital Twin System

Real-time ship monitoring and digital twin interface inspired by Seadronix's AI autonomous navigation technology.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-4.0-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r149-black?logo=three.js&logoColor=white)
![Zustand](https://img.shields.io/badge/State_Management-Zustand-orange)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚢 Project Overview

This project is a Real-time Ship Monitoring & Digital Twin Interface developed as a frontend portfolio piece. It visualizes ship locations using global AIS (Automatic Identification System) data and implements a Digital Twin environment that synchronizes with IoT sensor data to display the dynamic status of vessels in real-time.

## 🌟 Key Features

1. **Real-time AIS Map Interface**
   - Custom SVG markers that rotate based on ship heading
   - Vessel trajectory (path) visualization
   - Risk-level colors (safe / warning / danger) and geofencing (restricted zone) highlight

2. **Digital Twin 3D View**
   - High-fidelity 3D ship rendering using Three.js and React Three Fiber
   - Real-time Pitch/Roll/Heading with Lerp interpolation; selected ship highlight

3. **Collision Risk (CPA/TCPA)**
   - Closest Point of Approach distance and time between vessels
   - Auto risk level (500m danger, 1500m warning); fleet scan every 2 seconds

4. **Geofencing**
   - Automatic alert when a vessel enters Busan restricted waters

5. **Operation Modes**
   - Fleet / Safety / Marina mode switching

6. **High-Performance State Management**
   - Zustand with selective updates; 3D and map decoupled to reduce re-renders

7. **Global Support**
   - Multi-language (Korean, English) with i18next and browser language detection

## 🛠 Tech Stack

- **Framework**: React 19, TypeScript, Vite
- **State Management**: Zustand
- **Visualization**:
  - **Map**: Leaflet, React-Leaflet
  - **3D**: Three.js, @react-three/fiber, @react-three/drei
- **Styling**: Tailwind CSS, Lucide React
- **Communication**: WebSocket (AISStream API)

## 📂 Project Structure

```text
seadronix/
├── src/
│   ├── components/
│   │   ├── 3d/           # Three.js / React Three Fiber (Ship, Scene)
│   │   ├── dashboard/   # ModeSwitcher, StatsBar, Alerts
│   │   ├── layout/      # App layout, Sidebar, Header
│   │   └── map/         # Leaflet map and ship markers
│   ├── store/            # Zustand (ships, CPA/geofencing, tick)
│   ├── utils/            # Maritime math (CPA, latLngToXY, cogSogToVelocity)
│   ├── constants/        # Translations (i18n), regions, POD list
│   ├── i18n.ts           # i18next setup and language detection
│   └── pages/            # Dashboard, LiveMap, FleetStatus, Analytics, Settings
├── public/
└── .env                  # VITE_AISSTREAM_API_KEY (optional, for live AIS)
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
   VITE_AISSTREAM_API_KEY=your_api_key_here
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

### Security (API keys)

All use of the AIS API key is over secure channels only:

- **Server → AISStream**: The proxy sends the API key to AISStream only over **WSS** (`wss://stream.aisstream.io/v0/stream`). The server refuses to start if the AIS URL is not `wss://`.
- **Browser → Proxy**: The frontend uses **wss://** when the page is loaded over HTTPS (and **ws://** only for local development over HTTP). For production, serve the app over HTTPS so the WebSocket to the proxy uses WSS. The API key is never sent from the browser; it stays on the server.

## 💡 Technical Challenges & Solutions

### 1. Handling High-Frequency WebSocket Data

- **Problem**: Map marker flickering and performance degradation when receiving large AIS data streams (potentially hundreds of vessels).
- **Solution**:
  - **Throttled Updates**: Implemented a throttling mechanism in the Zustand store to limit the frequency of state updates.
  - **Threshold Filtering**: Added movement threshold checks; if a vessel moves less than 0.5m, the position update is skipped.
  - **Component Decoupling**: Separated the 3D canvas and Leaflet map from the main application state to prevent unnecessary expensive re-renders of the entire scene.

### 2. Precise 3D Digital Twin Synchronization

- **Problem**: Synchronizing the orientation (Pitch/Roll/Heading) of a 3D model with real-time sensor data without jerky movements.
- **Solution**:
  - **Lerp Interpolation**: Used `MathUtils.lerp` and `Slerp` for smooth transitions between Euler angles/quaternions.
  - **Maritime Math**: Developed utility functions to convert COG (Course Over Ground) and SOG (Speed Over Ground) into world-space velocity vectors for predictive positioning.

## 🚀 Future Roadmap

- [ ] Integration with historical AIS database for play-back functionality.
- [ ] Enhanced VR/AR support for bridge simulators.
