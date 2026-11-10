// 다국어 지원을 위한 번역 데이터
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
    shareLinkManualCopy: "Copy this link:",

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

    // Live Intelligence panel
    liveIntelligence: "Live Intelligence",
    vesselIdentification: "Vessel Identification",
    imoNo: "IMO NO",
    dest: "DEST",
    unspecified: "UNSPECIFIED",
    awaitingTelemetry: "Awaiting Telemetry",
    establishConnectionBySelecting: "Establish connection by selecting a vessel from the radar map.",

    // Map (ShipMap)
    trackingActive: "Tracking Active",
    initializeLink: "Initialize Link",
    locked: "LOCKED",
    course: "Course",
    vesselsDetected: "Vessels Detected",
    aisFeedLabel: "AIS FEED",
    live: "LIVE",

    // Settings page
    settingsTitle: "Settings",
    notifications: "Notifications",

    // Header search
    searchPlaceholder: "Search vessels by name or ID...",
    noVesselsMatch: "No vessels match",

    // Fleet Status page
    realtimeSyncActive: "Real-time Sync Active",
    totalVessels: "Total Vessels",
    activeMoored: "Active / Moored",
    vesselDirectory: "Vessel Directory",

    // Page titles (general)
    currentSpeed: "Current Speed",
    heading: "Heading",
    activeAlerts: "Active Alerts",
    noAlerts: "All Systems Nominal",
    noAlertsDesc: "No active alerts detected.",
    dismiss: "Dismiss",
    mapTracking: "Live GPS Tracking",

    // Nautical details
    callSign: "Call Sign",
    destination: "Destination",
    imo: "IMO No.",

    // Units
    kn: "kn",

    // Page titles
    analyticsTitle: "Analytics",
    fleetStatusTitle: "Fleet Status",

    // error messages
    connectingAis: "Connecting to AIS data...",
    aisDisconnected: "AIS server disconnected",

    // Regions
    busan: "Busan Port",
    incheon: "Incheon Port",
    singapore: "Singapore Strait",

    // Map overlay
    aisWaiting: "Waiting for AIS signal... (Live)",
    streamingActive: "Real-time streaming active",

    // Fleet status & analytics (additional)
    mmsi: "MMSI",
    vesselName: "Vessel Name",
    vesselType: "Type",
    status: "Status",
    active: "Active",
    moored: "Moored",

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
    // i18n.exists path in Alerts.tsx) — must match RESTRICTED_ZONE_ALERT_MESSAGE.
    "Entered restricted fishery zone": "Entered restricted fishery zone",
    alertAgeJustNow: "just now",
    alertAgeSeconds: "{{value}}s ago",
    alertAgeMinutes: "{{value}}m ago",
    alertAgeHours: "{{value}}h ago",
    alertAgeDays: "{{value}}d ago",

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
    shareLinkManualCopy: "아래 링크를 복사하세요:",

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

    // 라이브 인텔리전스 패널
    liveIntelligence: "라이브 인텔리전스",
    vesselIdentification: "선박 식별",
    imoNo: "IMO 번호",
    dest: "목적지",
    unspecified: "미지정",
    awaitingTelemetry: "텔레메트리 대기 중",
    establishConnectionBySelecting: "레이더 맵에서 선박을 선택하여 연결을 설정하세요.",

    // 지도 (ShipMap)
    trackingActive: "추적 활성화",
    initializeLink: "링크 초기화",
    locked: "잠김",
    course: "항로",
    vesselsDetected: "감지된 선박",
    aisFeedLabel: "AIS 피드",
    live: "LIVE",

    // 설정 페이지
    settingsTitle: "설정",
    notifications: "알림",

    // 헤더 검색
    searchPlaceholder: "선박명 또는 ID로 검색...",
    noVesselsMatch: "일치하는 선박 없음",

    // 함대 상태 페이지
    realtimeSyncActive: "실시간 동기화 활성",
    totalVessels: "전체 선박",
    activeMoored: "운항 중 / 정박",
    vesselDirectory: "선박 디렉토리",

    currentSpeed: "현재 속도",
    heading: "선수 방향",
    activeAlerts: "활성 알림",
    noAlerts: "모든 시스템 정상",
    noAlertsDesc: "현재 감지된 알림이 없습니다.",
    dismiss: "확인",
    mapTracking: "실시간 GPS 추적 중",

    // 해양 세부정보
    callSign: "호출 부호",
    destination: "목적지",
    imo: "IMO 번호",

    // 단위
    kn: "노트",

    // 페이지 제목
    analyticsTitle: "분석",
    fleetStatusTitle: "선단 상태",

    // 에러 메시지
    connectingAis: "실제 데이터(AIS) 연결 시도 중...",
    aisDisconnected: "AIS 서버랑 연결 끊어짐",

    // 해역
    busan: "부산항",
    incheon: "인천항",
    singapore: "싱가포르 해협",

    // 지도 오버레이
    aisWaiting: "AIS 신호 대기 중... (실시간)",
    streamingActive: "실시간 스트리밍 활성화",

    // 선단 상태 및 분석 (추가)
    mmsi: "MMSI",
    vesselName: "선박명",
    vesselType: "선종",
    status: "상태",
    active: "운항 중",
    moored: "정박 중",

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
    "Entered restricted fishery zone": "제한 수역에 진입했습니다",
    alertAgeJustNow: "방금 전",
    alertAgeSeconds: "{{value}}초 전",
    alertAgeMinutes: "{{value}}분 전",
    alertAgeHours: "{{value}}시간 전",
    alertAgeDays: "{{value}}일 전",

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
    appName: "SEATRACE",
    opsConsole: "シートレース運用コンソール",

    navDashboard: "ダッシュボード",
    navLiveMap: "ライブマップ",
    navFleetStatus: "船隊ステータス",
    navAnalytics: "分析",
    navSettings: "設定",

    fleetMgr: "船隊管理",
    safetyRisk: "安全リスク",
    tourism: "観光",

    regionBusan: "釜山",
    regionIncheon: "仁川",
    regionGlobal: "シンガポール",

    activeFleet: "稼働船隊",
    vesselsNearby: "周辺船舶",
    atSea: "航行中",

    share: "共有",
    export: "エクスポート",
    shareLinkCopied: "公開共有リンクをコピーしました！",
    shareLinkManualCopy: "このリンクをコピーしてください:",

    fleetDeployment: "船隊配置",
    searchLabel: "検索",
    vessel: "隻",
    vessels: "隻",
    noVesselsRegistered: "登録された船舶がありません。",
    registerToFleet: "＋ 船隊に登録",
    historicalReplay: "履歴リプレイ",
    pts: "点",

    velocity: "速力",

    liveIntelligence: "ライブインテリジェンス",
    vesselIdentification: "船舶識別",
    imoNo: "IMO番号",
    dest: "目的地",
    unspecified: "未指定",
    awaitingTelemetry: "テレメトリ待機中",
    establishConnectionBySelecting: "レーダーマップで船舶を選択して接続を確立してください。",

    trackingActive: "追跡中",
    initializeLink: "リンク初期化",
    locked: "ロック",
    course: "針路",
    vesselsDetected: "検出された船舶",
    aisFeedLabel: "AISフィード",
    live: "LIVE",

    settingsTitle: "設定",
    notifications: "通知",

    searchPlaceholder: "船名またはIDで船舶を検索...",
    noVesselsMatch: "一致する船舶なし",

    realtimeSyncActive: "リアルタイム同期中",
    totalVessels: "総船舶数",
    activeMoored: "航行中 / 係留中",
    vesselDirectory: "船舶ディレクトリ",

    currentSpeed: "現在速力",
    heading: "船首方位",
    activeAlerts: "有効なアラート",
    noAlerts: "全システム正常",
    noAlertsDesc: "有効なアラートは検出されていません。",
    dismiss: "閉じる",
    mapTracking: "ライブGPS追跡",

    callSign: "呼出符号",
    destination: "目的地",
    imo: "IMO番号",

    kn: "ノット",

    analyticsTitle: "分析",
    fleetStatusTitle: "船隊ステータス",

    connectingAis: "AISデータに接続中...",
    aisDisconnected: "AISサーバーとの接続が切断されました",

    busan: "釜山港",
    incheon: "仁川港",
    singapore: "シンガポール海峡",

    aisWaiting: "AIS信号を待機中... (ライブ)",
    streamingActive: "リアルタイムストリーミング中",

    mmsi: "MMSI",
    vesselName: "船名",
    vesselType: "船種",
    status: "ステータス",
    active: "航行中",
    moored: "係留中",

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

    navStatusLabel: "航行状態",
    cogLabel: "COG",
    hdgLabel: "HDG",
    draughtLabel: "喫水",
    dimensionsLabel: "寸法",
    etaLabel: "ETA",
    eta: "ETA",
    lastReport: "最終報告",
    speed: "速力",

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
    "Entered restricted fishery zone": "制限水域に進入しました",
    alertAgeJustNow: "たった今",
    alertAgeSeconds: "{{value}}秒前",
    alertAgeMinutes: "{{value}}分前",
    alertAgeHours: "{{value}}時間前",
    alertAgeDays: "{{value}}日前",

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

    streamConnecting: "接続中",
    streamLive: "ライブ",
    streamIdle: "アイドル",
    streamIdleDetail: "ストリームアイドル",
    streamError: "接続エラー",
    streamErrorDetail: "ライブフィードを利用できません",
    streamReconnecting: "再接続中",
    streamReconnectingDetail: "ライブフィードに再接続中...",

    mapLayers: "レイヤー",
    basemapOsm: "標準",
    basemapLight: "ライト",
    basemapDark: "ダーク",
    basemapSat: "衛星",
    seamarkOverlay: "海上標識",
    moreVesselsHidden: "隻を非表示 — ズームイン",

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

    unitKnots: "ノット",
    unitKmh: "km/h",
    kmh: "km/h",

    modeFleetDesc: "登録された船隊の船舶のみ",
    modeMarinaDesc: "7ノット未満の小型船舶",
    modeSafetyDesc: "グローバルアラートフィード監視",

    mainNavigation: "メインナビゲーション",
    openNavigation: "ナビゲーションメニューを開く",
    exitReplay: "リプレイ終了",
    loading3d: "3D読み込み中...",
    searchCacheBadge: "キャッシュ",
    searchingCache: "拡張カバレッジを検索中...",

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
// Type definitions (for autocomplete).
export type Language = "en" | "ko" | "ja";
export type TranslationKey = keyof typeof translations.en;
