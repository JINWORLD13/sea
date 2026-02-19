# Language Selection / 언어 선택 / 言語選択

환영합니다! 문서 조회를 위해 원하시는 언어를 선택해 주세요:

- [English](README.md)
- **[한국어](README.ko.md)**
- [日本語](README.ja.md)

---

# AI Maritime Monitoring & Digital Twin System

해상 선박 모니터링 및 디지털 트윈 인터페이스 프로젝트입니다.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-4.0-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r149-black?logo=three.js&logoColor=white)
![Zustand](https://img.shields.io/badge/State_Management-Zustand-orange)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚢 프로젝트 개요

이 프로젝트는 자율 운항 및 해양 AI 인지 기술을 바탕으로 한 실시간 선박 모니터링 시스템입니다. AIS(Automatic Identification System) 데이터를 활용하여 선박의 위치를 시각화하고, IoT 센서 데이터를 동기화하여 선박의 상태를 실시간으로 표시하는 디지털 트윈 환경을 구현합니다.

## 🌟 주요 기능

1. **실시간 AIS 지도 인터페이스**
   - 선박의 Heading 데이터를 기반으로 한 사용자 정의 마커 회전 시스템
   - 과거 좌표 데이터를 활용한 선박 경로 예측 및 시각화

2. **디지털 트윈 3D 뷰**
   - Three.js 및 React Three Fiber를 이용한 고정밀 3D 선박 렌더링
   - WebSocket을 통한 Pitch 및 Roll 데이터 동기화로 실시간 기동 시뮬레이션

3. **고성능 상태 관리**
   - Zustand를 활용하여 초당 수십 건의 AIS 스트림 데이터 처리 최적화
   - 변경된 데이터만 업데이트하는 최적화 로직 적용

4. **글로벌 지원**
   - i18next를 활용한 한국어, 영어, 일본어 다국어 지원

## 🛠 기술 스택

- **프레임워크**: React 19, TypeScript, Vite
- **상태 관리**: Zustand
- **시각화**:
  - **Map**: Leaflet, React-Leaflet
  - **3D**: Three.js, @react-three/fiber, @react-three/drei
- **스타일링**: Tailwind CSS, Lucide React
- **통신**: WebSocket (AISStream API)

## 📂 프로젝트 구조

```text
seadronix/
├── src/
│   ├── components/
│   │   ├── 3d/           # Three.js / React Three Fiber (Ship, Scene)
│   │   ├── dashboard/   # ModeSwitcher, StatsBar, Alerts
│   │   ├── layout/      # App 레이아웃, Sidebar, Header
│   │   └── map/         # Leaflet 지도 및 선박 마커
│   ├── store/            # Zustand (선박, CPA/지오펜싱, tick)
│   ├── utils/            # 해상 수학 (CPA, latLngToXY, cogSogToVelocity)
│   ├── constants/        # 번역( i18n ), 해역, 목적항 목록
│   ├── i18n.ts           # i18next 설정 및 언어 감지
│   └── pages/            # Dashboard, LiveMap, FleetStatus, Analytics, Settings
├── public/
└── .env                  # VITE_AISSTREAM_API_KEY (선택, 실시간 AIS용)
```

## 🚀 시작 가이드

1. 저장소를 복제합니다.

   ```bash
   git clone https://github.com/JINWORLD13/sea.git
   ```

2. 종속성을 설치합니다.

   ```bash
   npm install
   ```

3. 환경 변수를 설정합니다. (.env)

   ```
   VITE_AISSTREAM_API_KEY=your_api_key_here
   ```

### 데이터 흐름

**프론트 ↔ 프록시 서버 ↔ AISStream** — WebSocket 쌍방향 통신. 프론트에서 구독 요청(예: BoundingBoxes)을 서버로 보내면, 서버가 AISStream으로 전달하고, AIS 데이터는 AISStream → 서버 → 프론트로 스트리밍됩니다.

## 💡 기술적 도전 및 해결책

### 1. 고주파 WebSocket 데이터 처리 최적화

- **문제**: 대량의 AIS 데이터(수백 척의 선박)가 실시간으로 유입될 때 지도 마커의 깜빡임과 전반적인 성능 저하 발생.
- **해결책**:
  - **Throttled Updates**: Zustand 스토어 내부에 쓰로틀링 메커니즘을 구현하여 상태 업데이트 빈도를 제어했습니다.
  - **Threshold 필터링**: 선박의 이동 거리가 임계값(예: 0.5m) 미만일 경우 불필요한 상태 업데이트를 생략하도록 로직을 설계했습니다.
  - **컴포넌트 분리**: 전체 화면 리렌더링을 방지하기 위해 3D 캔버스와 지도 레이어를 독립적인 컨텍스트로 격리했습니다.

### 2. 정밀한 3D 디지털 트윈 동기화

- **문제**: 센서로부터 수신되는 Pitch/Roll/Heading 데이터를 3D 모델에 끊김 없이 부드럽게 반영해야 함.
- **해결책**:
  - **Lerp 보간**: `MathUtils.lerp` 및 `Slerp`를 사용하여 각도 변화를 시각적으로 부드럽게 연결했습니다.
  - **해상 수학 활용**: COG(Course Over Ground) 및 SOG(Speed Over Ground) 데이터를 기반으로 예측 위치를 계산하는 유틸리티를 개발했습니다.

## 🚀 향후 로드맵

- [ ] 과거 AIS 데이터 재생 기능 (Playback) 통합
- [ ] 브릿지 시뮬레이터를 위한 VR/AR 지원 확장
