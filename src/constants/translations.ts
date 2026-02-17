// 다국어 지원을 위한 번역 데이터
// 多言語対応のための翻訳データ
// Translation data for i18n.
export const translations = {
  en: {
    // App / Brand
    appName: "SEADRONIX",
    opsConsole: "Seadronix OPS Console",

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
    regionGlobal: "Global",

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
    globalCoverageActive: "Global Coverage Active",

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
  },
  ko: {
    // 앱/브랜드
    appName: "SEADRONIX",
    opsConsole: "시드로닉스 운영 콘솔",

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
    regionGlobal: "글로벌",

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
    globalCoverageActive: "글로벌 커버리지 활성",

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
  },
};

// 타입 정의 (자동완성 되게 하려고)
// 型定義（オートコンプリート用）
// Type definitions (for autocomplete).
export type Language = "en" | "ko";
export type TranslationKey = keyof typeof translations.en;
