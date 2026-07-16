// 메인 레이아웃: 사이드바, 헤더, 콘텐츠 영역을 구성합니다.
// メインレイアウト：サイドバー、ヘッダー、コンテンツエリアを構成します。
// Main Layout: Configures sidebar, header, and content area.
import type { ReactElement, FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import {
  startAisStream,
  stopAisStream,
  useShipStore,
} from "../../store/useShipStore";

const AppLayout: FC = (): ReactElement => {
  const currentRegionId = useShipStore((state) => state.currentRegion.id);
  const currentRegionBounds = useShipStore((state) => state.currentRegion.bounds);

  // 모바일 오프캔버스 드로어 상태 (lg 미만에서만 시각적으로 의미가 있음)
  // モバイルのオフキャンバスドロワー状態（lg未満でのみ視覚的に意味を持つ）
  // Mobile off-canvas drawer state (only visually meaningful below lg).
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const openSidebar = useCallback((): void => {
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  // AIS 스트림 수명주기: 지역이 바뀌면 재구독. 재연결 로직은 스토어 내부에서 처리된다.
  // AISストリームのライフサイクル：地域が変わると再購読。再接続ロジックはストア内部で処理される。
  // AIS stream lifecycle: resubscribe on region change. Reconnection is handled inside the store.
  useEffect(() => {
    startAisStream(currentRegionBounds);

    const maintenanceTimer = window.setInterval(() => {
      const state = useShipStore.getState();
      state.pruneStaleShips();
      state.checkRisks();
    }, 2000);

    return () => {
      stopAisStream();
      window.clearInterval(maintenanceTimer);
    };
  }, [currentRegionBounds, currentRegionId]);

  /**
   * [KO]
   * <div(전체 레이아웃)>
   *  <Sidebar(사이드바 / 모바일에선 드로어)>
   *  <div(콘텐츠 래퍼)>
   *    <Header(헤더 / 햄버거로 드로어 열기)>
   *    <main(콘텐츠 영역)>
   *      <Outlet(라우트 페이지)>
   *    </main>
   *  </div>
   * </div>
   */
  /**
   * [JA]
   * <div(全体レイアウト)>
   *  <Sidebar(サイドバー / モバイルではドロワー)>
   *  <div(コンテンツラッパー)>
   *    <Header(ヘッダー / ハンバーガーでドロワーを開く)>
   *    <main(コンテンツエリア)>
   *      <Outlet(ルートページ)>
   *    </main>
   *  </div>
   * </div>
   */
  /**
   * [EN]
   * <div(Global Layout)>
   *  <Sidebar(Sidebar / drawer on mobile)>
   *  <div(Content Wrapper)>
   *    <Header(Header / hamburger opens drawer)>
   *    <main(Content Area)>
   *      <Outlet(Route Page)>
   *    </main>
   *  </div>
   * </div>
   */
  const layoutMarkup: ReactElement = (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* 사이드바 메뉴 (サイドバーメニュー / Sidebar menu) */}
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 transition-all duration-300">
        {/* 상단 헤더 (上部ヘッダー / Top header) */}
        <Header onMenuClick={openSidebar} />

        {/* 주 콘텐츠 영역 (メインコンテンツエリア / Main content area) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pt-20 px-4 sm:px-6 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );

  return layoutMarkup;
};

export default AppLayout;
