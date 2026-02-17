// 메인 레이아웃: 사이드바, 헤더, 콘텐츠 영역을 구성합니다.
// メインレイアウト：サイドバー、ヘッダー、コンテンツエリアを構成します。
// Main Layout: Configures sidebar, header, and content area.
import type { ReactElement, FC } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const AppLayout: FC = (): ReactElement => {
  /**
   * [KO]
   * <div(전체 레이아웃)>
   *  <Sidebar(사이드바)>
   *  <div(콘텐츠 래퍼)>
   *    <Header(헤더)>
   *    <main(콘텐츠 영역)>
   *      <Outlet(라우트 페이지)>
   *    </main>
   *  </div>
   * </div>
   */
  /**
   * [JA]
   * <div(全体レイアウト)>
   *  <Sidebar(サイドバー)>
   *  <div(コンテンツラッパー)>
   *    <Header(ヘッダー)>
   *    <main(コンテンツエリア)>
   *      <Outlet(ルートページ)>
   *    </main>
   *  </div>
   * </div>
   */
  /**
   * [EN]
   * <div(Global Layout)>
   *  <Sidebar(Sidebar)>
   *  <div(Content Wrapper)>
   *    <Header(Header)>
   *    <main(Content Area)>
   *      <Outlet(Route Page)>
   *    </main>
   *  </div>
   * </div>
   */
  const layoutMarkup: ReactElement = (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* 사이드바 메뉴 (サイドバーメニュー / Sidebar menu) */}
      <Sidebar />

      <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
        {/* 상단 헤더 (上部ヘッダー / Top header) */}
        <Header />

        {/* 주 콘텐츠 영역 (メインコンテンツエリア / Main content area) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pt-20 px-6 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );

  return layoutMarkup;
};

export default AppLayout;
