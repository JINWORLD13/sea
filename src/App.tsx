import type { ReactElement } from "react";
import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

// 라우트별 코드 스플리팅: 첫 화면(대시보드)에 필요 없는 페이지는 지연 로드한다.
// Route-level code splitting: pages not needed for the first screen load lazily.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LiveMap = lazy(() => import("./pages/LiveMap"));
const FleetStatus = lazy(() => import("./pages/FleetStatus"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));

const RouteFallback = (): ReactElement => (
  <div className="h-[60vh] flex items-center justify-center text-slate-500 text-xs uppercase tracking-widest">
    Loading...
  </div>
);

// "/" 리다이렉트에서 ?mmsi= 같은 쿼리를 보존한다 — 공유 링크가 이 경로로 들어온다.
// Preserve the query string (e.g. ?mmsi=) across the "/" redirect — share
// links arrive on this path.
const RootRedirect = (): ReactElement => {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: "/dashboard", search: location.search }}
      replace={true}
    />
  );
};

const NotFound = (): ReactElement => (
  <div className="h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6">
    <p className="text-6xl font-black text-white/20 tracking-widest">404</p>
    <p className="text-sm text-slate-400">
      This route does not exist. The console lives on the dashboard.
    </p>
    <Link
      to="/dashboard"
      className="text-xs font-bold uppercase tracking-widest text-indigo-300 border border-indigo-400/40 rounded-xl px-4 py-2 hover:bg-indigo-500/20 transition-colors"
    >
      Back to Dashboard
    </Link>
  </div>
);

const App = (): ReactElement => {
  const result: ReactElement = (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/map"
            element={
              <Suspense fallback={<RouteFallback />}>
                <LiveMap />
              </Suspense>
            }
          />
          <Route
            path="/fleet"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FleetStatus />
              </Suspense>
            }
          />
          <Route
            path="/analytics"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Analytics />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Settings />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );

  return result;
};

export default App;
