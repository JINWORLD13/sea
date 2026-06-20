import type { ReactElement } from "react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

const App = (): ReactElement => {
  const result: ReactElement = (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace={true} />}
          />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );

  return result;
};

export default App;
