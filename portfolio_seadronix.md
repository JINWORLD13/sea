# Portfolio: AI Maritime Monitoring & Digital Twin System

> **신입 프론트엔드 개발자 지원용 프로젝트 포트폴리오**

## 🚢 Project Overview

씨드로닉스(Seadronix)의 핵심 도메인인 **'자율운항 및 해양 AI 인지'** 기술에 영감을 받아 제작한 **실시간 선박 모니터링 및 디지털 트윈 인터페이스** 프로젝트입니다. 전 세계 실시간 AIS(Automatic Identification System) 데이터를 활용하여 선박의 위치를 추적하고, IoT 센서 데이터를 시각화하여 지능형 항만 및 운항 관제 시스템의 프론트엔드를 구현했습니다.

## 🛠 Tech Stack

- **Framework & Language**: React 19, TypeScript, Vite
- **State Management**: Zustand (Context API 대비 렌더링 최적화 우수)
- **Visualization**:
  - **Map**: Leaflet, React-Leaflet (Real-time AIS Tracking)
  - **3D**: @react-three/fiber, Three.js (Digital Twin)
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Communication**: WebSockets (AISStream API)
- **I18n**: i18next (KR, EN, JA)

## 🌟 Key Features (Technical Highlights)

### 1. Real-time AIS Map Interface (`Leaflet`)

- **Dynamic Marker System**: 선박의 `heading`(기수 방향) 데이터를 실시간으로 반영하여 동작하는 SVG 커스텀 마커를 구현했습니다. 단순히 위치를 찍는 것을 넘어 선박의 진행 방향을 시각적으로 즉시 파악할 수 있도록 설계했습니다.
- **Predictive Path Drawing**: 과거 좌표 이력(`path` array)을 기반으로 선박의 이동 궤적을 Polyline으로 시각화하여 항로 이탈 여부를 모니터링할 수 있게 했습니다.

### 2. Digital Twin 3D View (`Three.js`)

- **Interactive 3D Simulation**: `@react-three/fiber`를 활용하여 특정 선박의 3D 모델을 브라우저에 렌더링했습니다.
- **IoT Data Sync**: WebSocket으로 수신되는 선박의 `Pitch`, `Roll` 데이터를 3D 모델의 회전 값(Rotation)과 실시간 동기화하여, 육상에서도 선박의 동태를 입체적으로 확인할 수 있는 디지털 트윈 기초 기능을 구현했습니다.

### 3. High-Performance State Management (`Zustand`)

- **Scalable Real-time Processing**: 초당 수십 개씩 유입되는 AIS 스트림 데이터를 효율적으로 처리하기 위해 Zustand를 사용했습니다. 불필요한 리렌더링을 방지하고 특정 선박 데이터만 부분 업데이트(`Partial Update`)하는 로직을 최적화했습니다.

### 4. Global UX & Performance Optimization

- **Multi-language Support**: 해양 산업의 글로벌 특성을 고려하여 `i18next`를 통한 3개국어(KR, EN, JA) 지원 환경을 구축했습니다.
- **Rendering Performance**: React의 재조정(Reconciliation) 과정을 고려하여, 고주파 데이터 업데이트 시 캔버스 및 지도 컴포넌트를 메모이제이션하여 FPS를 안정적으로 유지했습니다.

## 💡 Challenges & Growth (Junior's Perspective)

- **Challenge**: WebSocket을 통해 대량의 AIS 데이터가 들어올 때 지도상의 마커가 깜빡이거나 성능이 저하되는 이슈가 발생했습니다.
- **Solution**: Zustand의 `set` 내부에서 불변성을 유지하되, 좌표 변화가 일정 수준(Threshold) 이하일 경우 상태 업데이트를 스킵하여 렌더링 비용을 절감했습니다. 또한 Leaflet의 `RecenterMap` 컴포넌트를 분리하여 지도 타일의 불필요한 재로딩을 방지했습니다.
- **Learning**: 이 과정을 통해 단순한 기능 구현을 넘어, **데이터의 흐름을 제어하고 사용자 경험(UX)을 최적화하는 프론트엔드 엔지니어의 역할**에 대해 깊이 고민하게 되었습니다.

---

**"씨드로닉스에서 해양 기술의 미래를 함께 시각화하고 싶습니다."**
