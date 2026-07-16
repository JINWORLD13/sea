// 다국어 지원을 위한 번역 데이터
// 多言語対応のための翻訳データ
// Translation data for i18n.
export const translations = {
  en: {
    // App / Brand
    appName: "SEATRACE",
    opsConsole: "Seatrace OPS Console",

    // side bar navigation
    navDashboard: "Dashboard",
    navLiveMap: "Live Map",
    navFleetStatus: "Fleet Status",
    navAnalytics: "Analytics",
    navSettings: "Settings",

    // Dashboard Mode
    fleetMgr: "Fleet Mgr",
    safetyRisk: "Safety Risk",
    tourism: "Tourism",

    // region button
    regionBusan: "Busan",
    regionIncheon: "Incheon",
    regionGlobal: "Singapore",

    // Dashboard stats / status
    activeFleet: "Active Fleet",
    vesselsNearby: "Vessels Nearby",
    atSea: "At Sea",

    // Dashboard actions
    share: "Share",
    export: "Export",
    shareLinkCopied: "Public Share Link copied!",

    // Dashboard panel
    fleetDeployment: "Fleet Deployment",
    searchLabel: "Search",
    vessel: "vessel",
    vessels: "vessels",
    noVesselsRegistered: "No vessels registered.",
    registerToFleet: "+ Register to Fleet",
    historicalReplay: "Historical Replay",
    pts: "PTS",

    // Ship detail cards
    velocity: "Velocity",
    energy: "Energy",
    dynamics: "Dynamics",
    atmosphere: "Atmosphere",

    // Live Intelligence panel
    liveIntelligence: "Live Intelligence",
    vesselIdentification: "Vessel Identification",
    imoNo: "IMO NO",
    statusLive: "LIVE",
    dest: "DEST",
    unspecified: "UNSPECIFIED",
    awaitingTelemetry: "Awaiting Telemetry",
    establishConnectionBySelecting: "Establish connection by selecting a vessel from the radar map.",

    // Map (ShipMap)
    trackingActive: "Tracking Active",
    initializeLink: "Initialize Link",
    syncingAisFeed: "Syncing AIS Feed...",
    locked: "LOCKED",
    course: "Course",
    vesselsDetected: "Vessels Detected",
    aisFeedLabel: "AIS FEED",
    live: "LIVE",

    // Settings page
    settingsTitle: "Settings",
    accountProfile: "Account Profile",
    manageAccountInfo: "Manage your account info",
    edit: "Edit",
    notifications: "Notifications",
    configureAlertPrefs: "Configure alert preferences",
    security: "Security",
    password2fa: "Password & 2FA",
    manage: "Manage",

    // Analytics page
    liveDataFeed: "Live Data Feed",
    avgFleetFuel: "Avg Fleet Fuel",
    operationalEfficiency: "Operational Efficiency",
    fromYesterday: "↑ 2.4% from yesterday",
    estCo2Reduction: "Est. CO2 Reduction",
    totalFleetSavings: "Total fleet savings this week",
    currentFleetSnapshots: "Current Fleet Snapshots",
    dataUpdatedEvery5s: "Data updated every 5s",
    operationalEfficiencyDesc: "Operational efficiency is calculated using a proprietary blend of speed-over-ground (SOG), propulsor RPM, and real-time hull drag analysis from our digital twin sensors.",

    // Table columns
    fuel: "Fuel",

    // Header search
    searchPlaceholder: "Search vessels by name or ID...",
    noVesselsMatch: "No vessels match",
    operator: "Operator #42",
    busanPortControl: "Busan Port Control",
    operatorShort: "OP",

    // Live Map
    globalCoverageActive: "Selected Area Active",

    // Fleet Status page
    realtimeSyncActive: "Real-time Sync Active",
    totalVessels: "Total Vessels",
    activeMoored: "Active / Moored",
    vesselDirectory: "Vessel Directory",

    // Page titles (general)
    dashboardTitle: "Dashboard",
    monitoring: "Real-time monitoring",
    systemOnline: "System Online",
    disconnected: "Disconnected",
    currentSpeed: "Current Speed",
    engineRpm: "Engine RPM",
    fuelLevel: "Fuel Level",
    motion: "Motion (Pitch/Roll)",
    heading: "Heading",
    windConditions: "Wind Conditions",
    direction: "Direction",
    activeAlerts: "Active Alerts",
    noAlerts: "All Systems Nominal",
    noAlertsDesc: "No active alerts detected.",
    dismiss: "Dismiss",
    mapTracking: "Live GPS Tracking",
    updateRate: "Update Rate: 0.1s",
    digitalTwin: "Real-time Digital Twin",
    interactiveView: "Interactive 3D View",

    // Nautical details
    callSign: "Call Sign",
    destination: "Destination",
    imo: "IMO No.",

    // Alert messages
    alert_high_rpm: "High Engine RPM",
    alert_wind_gust: "Wind Gust Detected",
    alert_latency: "Communication Latency",
    alert_critical_overload: "CRITICAL: Engine Overload",

    realDataMode: "AIS LIVE",

    // Units
    kn: "kn",
    deg: "°",

    // Page titles
    analyticsTitle: "Analytics",
    fleetStatusTitle: "Fleet Status",
    comingSoon: "Coming Soon",
    fleetDetailMessage: "Detailed vessel list feature is under development!",

    // Language names
    korean: "Korean",
    english: "English",

    // error messages
    apiKeyMissing: "API Key is missing in .env file!",
    apiKeyMissingError: "Cannot connect to real data due to missing API key",
    connectingAis: "Connecting to AIS data...",
    aisConnected: "AIS server connected successfully!",
    aisDisconnected: "AIS server disconnected",
    dataParseError: "Failed to parse data",
    errorOccurred: "An error occurred",

    // Regions
    region: "Region",
    busan: "Busan Port",
    incheon: "Incheon Port",
    singapore: "Singapore Strait",
    selectShip: "Select a ship from the map",
    fleetCount: "Ships in view",

    // Map overlay
    searchResult: "Search result",
    detectedShips: "Detected ships",
    aisWaiting: "Waiting for AIS signal... (Live)",
    streamingActive: "Real-time streaming active",

    // Fleet status & analytics (additional)
    mmsi: "MMSI",
    vesselName: "Vessel Name",
    vesselType: "Type",
    status: "Status",
    active: "Active",
    moored: "Moored",
    fuelUsage: "Fuel Usage",
    efficiency: "Efficiency",
    avgEfficiency: "Avg Efficiency",

    // AIS ship-type labels (dynamic keys from aisTypes.ts)
    shipTypeCargo: "Cargo",
    shipTypeTanker: "Tanker",
    shipTypePassenger: "Passenger",
    shipTypeHighspeed: "High-speed craft",
    shipTypeFishing: "Fishing",
    shipTypeTug: "Tug & pilot",
    shipTypePleasure: "Pleasure craft",
    shipTypeSpecial: "Special craft",
    shipTypeOther: "Other",
    shipTypeUnknown: "Unknown",
    shipTypeAton: "Aid to navigation",
    shipTypeBase: "Base station",

    // AIS navigational-status labels
    navUnderway: "Under way",
    navAnchored: "At anchor",
    navMoored: "Moored",
    navNotUnderCommand: "Not under command",
    navRestricted: "Restricted maneuverability",
    navConstrained: "Constrained by draught",
    navAground: "Aground",
    navFishing: "Engaged in fishing",
    navSailing: "Under sail",
    navUnknown: "Unknown",

    // Vessel detail labels
    navStatusLabel: "Nav Status",
    cogLabel: "COG",
    hdgLabel: "HDG",
    draughtLabel: "Draught",
    dimensionsLabel: "Dimensions",
    etaLabel: "ETA",
    eta: "ETA",
    lastReport: "Last report",
    speed: "Speed",

    // Live session analytics
    liveSessionAnalytics: "Live session analytics",
    categoryBreakdown: "Vessels by type",
    navStatusBreakdown: "Navigational status",
    speedDistribution: "Speed distribution",
    speedBinAxis: "Speed over ground (kn)",
    movingVessels: "Moving vessels",
    noMovingVessels: "No vessels under way right now",
    avgMovingSpeed: "Avg speed (moving)",
    topFastestVessels: "Fastest vessels",
    trackedVessels: "Tracked vessels",
    atonCount: "Aids to navigation",
    baseStationCount: "Base stations",

    // Alerts & severity
    sessionAlerts: "Session alerts",
    alertSeverity: "Alerts by severity",
    noAlertsThisSession: "No alerts this session",
    clearAllAlerts: "Clear all",
    dismissAlert: "Dismiss alert",
    severityHigh: "High",
    severityMedium: "Medium",
    severityLow: "Low",
    alertKindCpa: "CPA",
    alertKindGeofence: "Geofence",
    alertAgeJustNow: "just now",
    alertAgeSeconds: "{{value}}s ago",
    alertAgeMinutes: "{{value}}m ago",
    alertAgeHours: "{{value}}h ago",

    // Live connection panel
    aisReconnecting: "Reconnecting to AIS stream...",
    connAgeAgo: "{{age}} ago",
    connCachedVessels: "Cached vessels",
    connChecking: "Checking…",
    connClients: "Connected clients",
    connEndpoint: "Endpoint",
    connLastUpstream: "Last upstream message",
    connPollNote: "Refreshes automatically every 15 seconds",
    connRefresh: "Refresh",
    connUnreachable: "Proxy unreachable",
    connUpstreamDown: "Upstream disconnected",
    connUpstreamLive: "Upstream live",
    connUptime: "Upstream uptime",

    // Stream status
    streamConnecting: "Connecting",
    streamLive: "Live",
    streamIdle: "Idle",
    streamIdleDetail: "Stream idle",
    streamError: "Connection error",
    streamErrorDetail: "Live feed unavailable",
    streamReconnecting: "Reconnecting",
    streamReconnectingDetail: "Reconnecting to live feed...",

    // Basemap & map layers
    mapLayers: "Layers",
    basemapOsm: "Standard",
    basemapLight: "Light",
    basemapDark: "Dark",
    basemapSat: "Satellite",
    seamarkOverlay: "Seamarks",
    moreVesselsHidden: "more vessels — zoom in",

    // Settings (map, connection, data)
    settingsMapSection: "Map & display",
    settingsBasemap: "Basemap",
    settingsBasemapDesc: "Base tile layer for the live map",
    settingsSpeedUnit: "Speed unit",
    settingsCourseVectors: "Course vectors",
    settingsTrails: "Vessel trails",
    settingsSeamarks: "Seamark overlay",
    settingsConnectionSection: "Live connection",
    settingsDefaultRegion: "Default region",
    settingsLanguage: "Language",
    settingsLanguageDesc: "Interface language",
    settingsDataSection: "Local data",
    clearShipCache: "Clear cached vessel data",
    clearShipCacheConfirm: "Clear cached vessel positions?",
    clearShipCacheYes: "Yes, clear",
    clearShipCacheNo: "Cancel",
    clearShipCacheDone: "Cached vessel data cleared",

    // Units
    unitKnots: "Knots",
    unitKmh: "km/h",
    kmh: "km/h",

    // Dashboard mode descriptions
    modeFleetDesc: "Registered fleet vessels only",
    modeMarinaDesc: "Small craft under 7 kn",
    modeSafetyDesc: "Global alert feed monitoring",

    // Misc UI
    mainNavigation: "Main navigation",
    openNavigation: "Open navigation menu",
    exitReplay: "Exit replay",
    loading3d: "Loading 3D...",
    searchCacheBadge: "Cache",
    searchingCache: "Searching extended coverage...",

    // Multi-line description keys
    settingsSpeedUnitDesc: "Unit used for vessel speeds across the app",
    settingsSeamarksDesc: "Show OpenSeaMap buoys, beacons and marks",
    settingsTrailsDesc: "Draw the recent track of the selected vessel",
    settingsCourseVectorsDesc: "Project course lines ahead of moving vessels",
    settingsDefaultRegionDesc: "Monitored region loaded at startup",
    clearShipCacheDesc:
      "Removes locally stored last-known vessel positions. Your fleet list and settings are kept.",
    connUnreachableHint:
      "Could not reach the AIS proxy. Check that the proxy server is running.",
    digitalTwinDemoNote: "Attitude data not present in AIS — animation is illustrative",
    analyticsScopeNote:
      "Computed in your browser from vessels tracked this session — not a historical database",
    analyticsEmpty: "Waiting for live AIS data — analytics populate as vessels arrive",
    noVesselsTracked: "No vessels are currently tracked — waiting for live AIS data",
    showingVessels: "Showing {{shown}} of {{total}} vessels",
  },
  ko: {
    // 앱/브랜드
    appName: "SEATRACE",
    opsConsole: "씨트레이스 운영 콘솔",

    // 네비게이션 (사이드바)
    navDashboard: "대시보드",
    navLiveMap: "라이브 맵",
    navFleetStatus: "선단 상태",
    navAnalytics: "분석",
    navSettings: "설정",

    // 대시보드 모드
    fleetMgr: "함대 관리",
    safetyRisk: "안전 리스크",
    tourism: "관광",

    // 지역 버튼 (짧은 라벨)
    regionBusan: "부산",
    regionIncheon: "인천",
    regionGlobal: "싱가포르",

    // 대시보드 통계/상태
    activeFleet: "활성 함대",
    vesselsNearby: "주변 선박",
    atSea: "항해 중",

    // 대시보드 액션
    share: "공유",
    export: "내보내기",
    shareLinkCopied: "공개 공유 링크가 복사되었습니다!",

    // 대시보드 패널
    fleetDeployment: "함대 배치",
    searchLabel: "검색",
    vessel: "척",
    vessels: "척",
    noVesselsRegistered: "등록된 선박이 없습니다.",
    registerToFleet: "+ 함대에 등록",
    historicalReplay: "역사 재생",
    pts: "점",

    // 선박 상세 카드
    velocity: "속도",
    energy: "연료",
    dynamics: "동역학",
    atmosphere: "대기",

    // 라이브 인텔리전스 패널
    liveIntelligence: "라이브 인텔리전스",
    vesselIdentification: "선박 식별",
    imoNo: "IMO 번호",
    statusLive: "LIVE",
    dest: "목적지",
    unspecified: "미지정",
    awaitingTelemetry: "텔레메트리 대기 중",
    establishConnectionBySelecting: "레이더 맵에서 선박을 선택하여 연결을 설정하세요.",

    // 지도 (ShipMap)
    trackingActive: "추적 활성화",
    initializeLink: "링크 초기화",
    syncingAisFeed: "AIS 피드 동기화 중...",
    locked: "잠김",
    course: "항로",
    vesselsDetected: "감지된 선박",
    aisFeedLabel: "AIS 피드",
    live: "LIVE",

    // 설정 페이지
    settingsTitle: "설정",
    accountProfile: "계정 프로필",
    manageAccountInfo: "계정 정보 관리",
    edit: "편집",
    notifications: "알림",
    configureAlertPrefs: "알림 기본 설정 구성",
    security: "보안",
    password2fa: "비밀번호 및 2FA",
    manage: "관리",

    // 분석 페이지
    liveDataFeed: "실시간 데이터 피드",
    avgFleetFuel: "평균 함대 연료",
    operationalEfficiency: "운영 효율",
    fromYesterday: "어제 대비 ↑ 2.4%",
    totalFleetSavings: "이번 주 전체 함대 절감량",
    estCo2Reduction: "예상 CO2 감소",
    currentFleetSnapshots: "현재 함대 스냅샷",
    dataUpdatedEvery5s: "5초마다 데이터 업데이트",
    operationalEfficiencyDesc: "운영 효율은 SOG(대지속도), 추진기 RPM, 디지털 트윈 센서의 실시간 선체 항력 분석을 독점적으로 혼합하여 계산합니다.",

    // 테이블 컬럼
    fuel: "연료",

    // 헤더 검색
    searchPlaceholder: "선박명 또는 ID로 검색...",
    noVesselsMatch: "일치하는 선박 없음",
    operator: "운영자 #42",
    busanPortControl: "부산항 관제",
    operatorShort: "OP",

    // 라이브 맵
    globalCoverageActive: "선택 해역 활성",

    // 함대 상태 페이지
    realtimeSyncActive: "실시간 동기화 활성",
    totalVessels: "전체 선박",
    activeMoored: "운항 중 / 정박",
    vesselDirectory: "선박 디렉토리",

    dashboardTitle: "대시보드",
    monitoring: "실시간 모니터링 중",
    systemOnline: "시스템 온라인",
    disconnected: "연결 끊김",
    currentSpeed: "현재 속도",
    engineRpm: "엔진 RPM",
    fuelLevel: "연료량",
    motion: "선박 움직임 (Pitch/Roll)",
    heading: "선수 방향",
    windConditions: "바람 상태",
    direction: "방향",
    activeAlerts: "활성 알림",
    noAlerts: "모든 시스템 정상",
    noAlertsDesc: "현재 감지된 알림이 없습니다.",
    dismiss: "확인",
    mapTracking: "실시간 GPS 추적 중",
    updateRate: "업데이트 주기: 0.1초",
    digitalTwin: "실시간 디지털 트윈",
    interactiveView: "인터랙티브 3D 뷰",

    // 해양 세부정보
    callSign: "호출 부호",
    destination: "목적지",
    imo: "IMO 번호",

    // 알림 메시지
    alert_high_rpm: "엔진 RPM 너무 높음",
    alert_wind_gust: "갑자기 바람 붐",
    alert_latency: "통신 약간 느림",
    alert_critical_overload: "경고: 엔진 과부하",

    realDataMode: "실시간 AIS",

    // 단위
    kn: "노트",
    deg: "도",

    // 페이지 제목
    analyticsTitle: "분석",
    fleetStatusTitle: "선단 상태",
    comingSoon: "준비 중...",
    fleetDetailMessage: "상세 선박 목록 기능 개발 중입니다!",

    // 언어 이름
    korean: "한국어",
    english: "English",

    // 에러 메시지
    apiKeyMissing: "API Key가 .env 파일에 없어요!",
    apiKeyMissingError: "API 키가 없어서 실제 데이터 연결 못함",
    connectingAis: "실제 데이터(AIS) 연결 시도 중...",
    aisConnected: "AIS 서버랑 연결 성공!",
    aisDisconnected: "AIS 서버랑 연결 끊어짐",
    dataParseError: "데이터 해석 실패",
    errorOccurred: "에러 발생",

    // 해역
    region: "선택 해역",
    busan: "부산항",
    incheon: "인천항",
    singapore: "싱가포르 해협",
    selectShip: "지도에서 배를 선택해주세요",
    fleetCount: "현재 감지된 선박",

    // 지도 오버레이
    searchResult: "검색 결과",
    detectedShips: "감지 선박",
    aisWaiting: "AIS 신호 대기 중... (실시간)",
    streamingActive: "실시간 스트리밍 활성화",

    // 선단 상태 및 분석 (추가)
    mmsi: "MMSI",
    vesselName: "선박명",
    vesselType: "선종",
    status: "상태",
    active: "운항 중",
    moored: "정박 중",
    fuelUsage: "연료 소모",
    efficiency: "효율",
    avgEfficiency: "평균 효율",

    // AIS 선종 라벨 (aisTypes.ts 동적 키)
    shipTypeCargo: "화물선",
    shipTypeTanker: "유조선",
    shipTypePassenger: "여객선",
    shipTypeHighspeed: "고속선",
    shipTypeFishing: "어선",
    shipTypeTug: "예인·도선",
    shipTypePleasure: "레저 선박",
    shipTypeSpecial: "특수선",
    shipTypeOther: "기타",
    shipTypeUnknown: "미상",
    shipTypeAton: "항로표지",
    shipTypeBase: "기지국",

    // AIS 항해 상태 라벨
    navUnderway: "항행 중",
    navAnchored: "정박 중",
    navMoored: "계류 중",
    navNotUnderCommand: "조종 불능",
    navRestricted: "조종 제한",
    navConstrained: "흘수 제약",
    navAground: "좌초",
    navFishing: "어로 작업 중",
    navSailing: "범주 중",
    navUnknown: "미상",

    // 선박 상세 라벨
    navStatusLabel: "항해 상태",
    cogLabel: "COG",
    hdgLabel: "HDG",
    draughtLabel: "흘수",
    dimensionsLabel: "제원",
    etaLabel: "ETA",
    eta: "ETA",
    lastReport: "마지막 보고",
    speed: "속도",

    // 실시간 세션 분석
    liveSessionAnalytics: "실시간 세션 분석",
    categoryBreakdown: "선종별 선박",
    navStatusBreakdown: "항해 상태",
    speedDistribution: "속도 분포",
    speedBinAxis: "대지 속도 (kn)",
    movingVessels: "이동 중인 선박",
    noMovingVessels: "현재 항행 중인 선박 없음",
    avgMovingSpeed: "평균 속도 (이동 중)",
    topFastestVessels: "최고 속도 선박",
    trackedVessels: "추적 중인 선박",
    atonCount: "항로표지",
    baseStationCount: "기지국",

    // 알림 및 심각도
    sessionAlerts: "세션 알림",
    alertSeverity: "심각도별 알림",
    noAlertsThisSession: "이번 세션 알림 없음",
    clearAllAlerts: "모두 지우기",
    dismissAlert: "알림 닫기",
    severityHigh: "높음",
    severityMedium: "중간",
    severityLow: "낮음",
    alertKindCpa: "CPA",
    alertKindGeofence: "지오펜스",
    alertAgeJustNow: "방금 전",
    alertAgeSeconds: "{{value}}초 전",
    alertAgeMinutes: "{{value}}분 전",
    alertAgeHours: "{{value}}시간 전",

    // 실시간 연결 패널
    aisReconnecting: "AIS 스트림에 재연결 중...",
    connAgeAgo: "{{age}} 전",
    connCachedVessels: "캐시된 선박",
    connChecking: "확인 중…",
    connClients: "연결된 클라이언트",
    connEndpoint: "엔드포인트",
    connLastUpstream: "마지막 업스트림 메시지",
    connPollNote: "15초마다 자동으로 새로고침됩니다",
    connRefresh: "새로고침",
    connUnreachable: "프록시에 연결할 수 없음",
    connUpstreamDown: "업스트림 연결 끊김",
    connUpstreamLive: "업스트림 실시간",
    connUptime: "업스트림 가동 시간",

    // 스트림 상태
    streamConnecting: "연결 중",
    streamLive: "실시간",
    streamIdle: "대기",
    streamIdleDetail: "스트림 대기 중",
    streamError: "연결 오류",
    streamErrorDetail: "실시간 피드를 사용할 수 없음",
    streamReconnecting: "재연결 중",
    streamReconnectingDetail: "실시간 피드에 재연결 중...",

    // 베이스맵 및 지도 레이어
    mapLayers: "레이어",
    basemapOsm: "표준",
    basemapLight: "라이트",
    basemapDark: "다크",
    basemapSat: "위성",
    seamarkOverlay: "해상 표지",
    moreVesselsHidden: "척 더 — 확대하세요",

    // 설정 (지도, 연결, 데이터)
    settingsMapSection: "지도 및 표시",
    settingsBasemap: "베이스맵",
    settingsBasemapDesc: "라이브 맵의 기본 타일 레이어",
    settingsSpeedUnit: "속도 단위",
    settingsCourseVectors: "침로 벡터",
    settingsTrails: "선박 항적",
    settingsSeamarks: "해상 표지 오버레이",
    settingsConnectionSection: "실시간 연결",
    settingsDefaultRegion: "기본 해역",
    settingsLanguage: "언어",
    settingsLanguageDesc: "인터페이스 언어",
    settingsDataSection: "로컬 데이터",
    clearShipCache: "캐시된 선박 데이터 삭제",
    clearShipCacheConfirm: "캐시된 선박 위치를 삭제할까요?",
    clearShipCacheYes: "예, 삭제",
    clearShipCacheNo: "취소",
    clearShipCacheDone: "캐시된 선박 데이터가 삭제되었습니다",

    // 단위
    unitKnots: "노트",
    unitKmh: "km/h",
    kmh: "km/h",

    // 대시보드 모드 설명
    modeFleetDesc: "등록된 함대 선박만",
    modeMarinaDesc: "7노트 미만 소형 선박",
    modeSafetyDesc: "글로벌 경보 피드 모니터링",

    // 기타 UI
    mainNavigation: "주 내비게이션",
    openNavigation: "내비게이션 메뉴 열기",
    exitReplay: "재생 종료",
    loading3d: "3D 로딩 중...",
    searchCacheBadge: "캐시",
    searchingCache: "확장 커버리지 검색 중...",

    // 여러 줄 설명 키
    settingsSpeedUnitDesc: "앱 전체에서 선박 속력에 사용하는 단위",
    settingsSeamarksDesc: "OpenSeaMap 부표·등표·항로표지 표시",
    settingsTrailsDesc: "선택한 선박의 최근 항적을 표시합니다",
    settingsCourseVectorsDesc: "이동 중인 선박의 침로선을 앞쪽으로 표시합니다",
    settingsDefaultRegionDesc: "시작 시 로드되는 감시 해역",
    clearShipCacheDesc:
      "로컬에 저장된 최근 선박 위치를 삭제합니다. 함대 목록과 설정은 유지됩니다.",
    connUnreachableHint:
      "AIS 프록시에 연결할 수 없습니다. 프록시 서버가 실행 중인지 확인하세요.",
    digitalTwinDemoNote: "자세 데이터는 AIS에 없습니다 — 애니메이션은 예시입니다",
    analyticsScopeNote:
      "이번 세션에서 추적한 선박을 브라우저에서 집계한 값입니다 — 과거 데이터베이스가 아닙니다",
    analyticsEmpty: "실시간 AIS 데이터 대기 중 — 선박이 들어오면 분석이 채워집니다",
    noVesselsTracked: "현재 추적 중인 선박이 없습니다 — 실시간 AIS 데이터 대기 중",
    showingVessels: "{{total}}척 중 {{shown}}척 표시",
  },
  ja: {
    // アプリ / ブランド
    appName: "SEATRACE",
    opsConsole: "シートレース運用コンソール",

    // サイドバーナビゲーション
    navDashboard: "ダッシュボード",
    navLiveMap: "ライブマップ",
    navFleetStatus: "船隊ステータス",
    navAnalytics: "分析",
    navSettings: "設定",

    // ダッシュボードモード
    fleetMgr: "船隊管理",
    safetyRisk: "安全リスク",
    tourism: "観光",

    // 地域ボタン
    regionBusan: "釜山",
    regionIncheon: "仁川",
    regionGlobal: "シンガポール",

    // ダッシュボード統計 / ステータス
    activeFleet: "稼働船隊",
    vesselsNearby: "周辺船舶",
    atSea: "航行中",

    // ダッシュボードアクション
    share: "共有",
    export: "エクスポート",
    shareLinkCopied: "公開共有リンクをコピーしました！",

    // ダッシュボードパネル
    fleetDeployment: "船隊配置",
    searchLabel: "検索",
    vessel: "隻",
    vessels: "隻",
    noVesselsRegistered: "登録された船舶がありません。",
    registerToFleet: "＋ 船隊に登録",
    historicalReplay: "履歴リプレイ",
    pts: "点",

    // 船舶詳細カード
    velocity: "速力",
    energy: "エネルギー",
    dynamics: "動力学",
    atmosphere: "大気",

    // ライブインテリジェンスパネル
    liveIntelligence: "ライブインテリジェンス",
    vesselIdentification: "船舶識別",
    imoNo: "IMO番号",
    statusLive: "LIVE",
    dest: "目的地",
    unspecified: "未指定",
    awaitingTelemetry: "テレメトリ待機中",
    establishConnectionBySelecting: "レーダーマップで船舶を選択して接続を確立してください。",

    // 地図 (ShipMap)
    trackingActive: "追跡中",
    initializeLink: "リンク初期化",
    syncingAisFeed: "AISフィード同期中...",
    locked: "ロック",
    course: "針路",
    vesselsDetected: "検出された船舶",
    aisFeedLabel: "AISフィード",
    live: "LIVE",

    // 設定ページ
    settingsTitle: "設定",
    accountProfile: "アカウントプロフィール",
    manageAccountInfo: "アカウント情報を管理",
    edit: "編集",
    notifications: "通知",
    configureAlertPrefs: "アラート設定を構成",
    security: "セキュリティ",
    password2fa: "パスワードと2FA",
    manage: "管理",

    // 分析ページ
    liveDataFeed: "ライブデータフィード",
    avgFleetFuel: "船隊平均燃料",
    operationalEfficiency: "運用効率",
    fromYesterday: "前日比 ↑ 2.4%",
    estCo2Reduction: "推定CO2削減量",
    totalFleetSavings: "今週の船隊総削減量",
    currentFleetSnapshots: "現在の船隊スナップショット",
    dataUpdatedEvery5s: "5秒ごとにデータ更新",
    operationalEfficiencyDesc: "運用効率は、対地速力（SOG）、推進器RPM、デジタルツインセンサーによるリアルタイム船体抵抗解析を独自に組み合わせて算出されます。",

    // テーブル列
    fuel: "燃料",

    // ヘッダー検索
    searchPlaceholder: "船名またはIDで船舶を検索...",
    noVesselsMatch: "一致する船舶なし",
    operator: "オペレーター #42",
    busanPortControl: "釜山港管制",
    operatorShort: "OP",

    // ライブマップ
    globalCoverageActive: "選択海域アクティブ",

    // 船隊ステータスページ
    realtimeSyncActive: "リアルタイム同期中",
    totalVessels: "総船舶数",
    activeMoored: "航行中 / 係留中",
    vesselDirectory: "船舶ディレクトリ",

    // ページタイトル (一般)
    dashboardTitle: "ダッシュボード",
    monitoring: "リアルタイム監視中",
    systemOnline: "システムオンライン",
    disconnected: "切断",
    currentSpeed: "現在速力",
    engineRpm: "エンジンRPM",
    fuelLevel: "燃料残量",
    motion: "動揺（ピッチ/ロール）",
    heading: "船首方位",
    windConditions: "風況",
    direction: "方向",
    activeAlerts: "有効なアラート",
    noAlerts: "全システム正常",
    noAlertsDesc: "有効なアラートは検出されていません。",
    dismiss: "閉じる",
    mapTracking: "ライブGPS追跡",
    updateRate: "更新間隔: 0.1秒",
    digitalTwin: "リアルタイムデジタルツイン",
    interactiveView: "インタラクティブ3Dビュー",

    // 航海詳細
    callSign: "呼出符号",
    destination: "目的地",
    imo: "IMO番号",

    // アラートメッセージ
    alert_high_rpm: "エンジンRPM高",
    alert_wind_gust: "突風を検出",
    alert_latency: "通信遅延",
    alert_critical_overload: "重大: エンジン過負荷",

    realDataMode: "AIS ライブ",

    // 単位
    kn: "ノット",
    deg: "度",

    // ページタイトル
    analyticsTitle: "分析",
    fleetStatusTitle: "船隊ステータス",
    comingSoon: "近日公開",
    fleetDetailMessage: "詳細な船舶リスト機能は開発中です！",

    // 言語名
    korean: "韓国語",
    english: "英語",

    // エラーメッセージ
    apiKeyMissing: "APIキーが.envファイルにありません！",
    apiKeyMissingError: "APIキーがないため実データに接続できません",
    connectingAis: "AISデータに接続中...",
    aisConnected: "AISサーバーに接続しました！",
    aisDisconnected: "AISサーバーとの接続が切断されました",
    dataParseError: "データの解析に失敗しました",
    errorOccurred: "エラーが発生しました",

    // 海域
    region: "海域",
    busan: "釜山港",
    incheon: "仁川港",
    singapore: "シンガポール海峡",
    selectShip: "地図から船舶を選択してください",
    fleetCount: "表示中の船舶",

    // 地図オーバーレイ
    searchResult: "検索結果",
    detectedShips: "検出船舶",
    aisWaiting: "AIS信号を待機中... (ライブ)",
    streamingActive: "リアルタイムストリーミング中",

    // 船隊ステータスと分析 (追加)
    mmsi: "MMSI",
    vesselName: "船名",
    vesselType: "船種",
    status: "ステータス",
    active: "航行中",
    moored: "係留中",
    fuelUsage: "燃料消費",
    efficiency: "効率",
    avgEfficiency: "平均効率",

    // AIS 船種ラベル (aisTypes.ts の動的キー)
    shipTypeCargo: "貨物船",
    shipTypeTanker: "タンカー",
    shipTypePassenger: "旅客船",
    shipTypeHighspeed: "高速船",
    shipTypeFishing: "漁船",
    shipTypeTug: "タグ・水先",
    shipTypePleasure: "プレジャーボート",
    shipTypeSpecial: "特殊船",
    shipTypeOther: "その他",
    shipTypeUnknown: "不明",
    shipTypeAton: "航路標識",
    shipTypeBase: "基地局",

    // AIS 航行状態ラベル
    navUnderway: "航行中",
    navAnchored: "錨泊中",
    navMoored: "係留中",
    navNotUnderCommand: "操縦不能",
    navRestricted: "操縦制限",
    navConstrained: "喫水制限",
    navAground: "座礁",
    navFishing: "漁労中",
    navSailing: "帆走中",
    navUnknown: "不明",

    // 船舶詳細ラベル
    navStatusLabel: "航行状態",
    cogLabel: "COG",
    hdgLabel: "HDG",
    draughtLabel: "喫水",
    dimensionsLabel: "寸法",
    etaLabel: "ETA",
    eta: "ETA",
    lastReport: "最終報告",
    speed: "速力",

    // ライブセッション分析
    liveSessionAnalytics: "ライブセッション分析",
    categoryBreakdown: "船種別船舶",
    navStatusBreakdown: "航行状態",
    speedDistribution: "速力分布",
    speedBinAxis: "対地速力 (kn)",
    movingVessels: "移動中の船舶",
    noMovingVessels: "現在航行中の船舶はありません",
    avgMovingSpeed: "平均速力（移動中）",
    topFastestVessels: "最速船舶",
    trackedVessels: "追跡中の船舶",
    atonCount: "航路標識",
    baseStationCount: "基地局",

    // アラートと重要度
    sessionAlerts: "セッションアラート",
    alertSeverity: "重要度別アラート",
    noAlertsThisSession: "このセッションのアラートなし",
    clearAllAlerts: "すべてクリア",
    dismissAlert: "アラートを閉じる",
    severityHigh: "高",
    severityMedium: "中",
    severityLow: "低",
    alertKindCpa: "CPA",
    alertKindGeofence: "ジオフェンス",
    alertAgeJustNow: "たった今",
    alertAgeSeconds: "{{value}}秒前",
    alertAgeMinutes: "{{value}}分前",
    alertAgeHours: "{{value}}時間前",

    // ライブ接続パネル
    aisReconnecting: "AISストリームに再接続中...",
    connAgeAgo: "{{age}}前",
    connCachedVessels: "キャッシュ船舶",
    connChecking: "確認中…",
    connClients: "接続クライアント数",
    connEndpoint: "エンドポイント",
    connLastUpstream: "最終アップストリームメッセージ",
    connPollNote: "15秒ごとに自動更新されます",
    connRefresh: "更新",
    connUnreachable: "プロキシに接続できません",
    connUpstreamDown: "アップストリーム切断",
    connUpstreamLive: "アップストリーム稼働中",
    connUptime: "アップストリーム稼働時間",

    // ストリーム状態
    streamConnecting: "接続中",
    streamLive: "ライブ",
    streamIdle: "アイドル",
    streamIdleDetail: "ストリームアイドル",
    streamError: "接続エラー",
    streamErrorDetail: "ライブフィードを利用できません",
    streamReconnecting: "再接続中",
    streamReconnectingDetail: "ライブフィードに再接続中...",

    // ベースマップと地図レイヤー
    mapLayers: "レイヤー",
    basemapOsm: "標準",
    basemapLight: "ライト",
    basemapDark: "ダーク",
    basemapSat: "衛星",
    seamarkOverlay: "海上標識",
    moreVesselsHidden: "隻を非表示 — ズームイン",

    // 設定 (地図・接続・データ)
    settingsMapSection: "地図と表示",
    settingsBasemap: "ベースマップ",
    settingsBasemapDesc: "ライブマップの基本タイルレイヤー",
    settingsSpeedUnit: "速力単位",
    settingsCourseVectors: "針路ベクトル",
    settingsTrails: "船舶航跡",
    settingsSeamarks: "海上標識オーバーレイ",
    settingsConnectionSection: "ライブ接続",
    settingsDefaultRegion: "デフォルト海域",
    settingsLanguage: "言語",
    settingsLanguageDesc: "インターフェース言語",
    settingsDataSection: "ローカルデータ",
    clearShipCache: "キャッシュされた船舶データを削除",
    clearShipCacheConfirm: "キャッシュされた船舶位置を削除しますか？",
    clearShipCacheYes: "はい、削除します",
    clearShipCacheNo: "キャンセル",
    clearShipCacheDone: "キャッシュされた船舶データを削除しました",

    // 単位
    unitKnots: "ノット",
    unitKmh: "km/h",
    kmh: "km/h",

    // ダッシュボードモードの説明
    modeFleetDesc: "登録された船隊の船舶のみ",
    modeMarinaDesc: "7ノット未満の小型船舶",
    modeSafetyDesc: "グローバルアラートフィード監視",

    // その他 UI
    mainNavigation: "メインナビゲーション",
    openNavigation: "ナビゲーションメニューを開く",
    exitReplay: "リプレイ終了",
    loading3d: "3D読み込み中...",
    searchCacheBadge: "キャッシュ",
    searchingCache: "拡張カバレッジを検索中...",

    // 複数行の説明キー
    settingsSpeedUnitDesc: "アプリ全体で船舶の速力に使用する単位",
    settingsSeamarksDesc: "OpenSeaMapのブイ・標識・航路標識を表示",
    settingsTrailsDesc: "選択した船舶の最近の航跡を描画します",
    settingsCourseVectorsDesc: "移動中の船舶の針路線を前方に投影します",
    settingsDefaultRegionDesc: "起動時に読み込まれる監視海域",
    clearShipCacheDesc:
      "ローカルに保存された最新の船舶位置を削除します。船隊リストと設定は保持されます。",
    connUnreachableHint:
      "AISプロキシに接続できません。プロキシサーバーが起動しているか確認してください。",
    digitalTwinDemoNote: "姿勢データはAISに含まれません — アニメーションは説明用です",
    analyticsScopeNote:
      "このセッションで追跡した船舶をブラウザ側で集計した値です — 過去データベースではありません",
    analyticsEmpty: "ライブAISデータを待機中 — 船舶の受信に応じて分析が生成されます",
    noVesselsTracked: "現在追跡中の船舶はありません — ライブAISデータを待機中",
    showingVessels: "{{total}}隻中{{shown}}隻を表示",
  },
};

// 타입 정의 (자동완성 되게 하려고)
// 型定義（オートコンプリート用）
// Type definitions (for autocomplete).
export type Language = "en" | "ko" | "ja";
export type TranslationKey = keyof typeof translations.en;
