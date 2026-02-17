import type { ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import LiveMap from "./pages/LiveMap";
import FleetStatus from "./pages/FleetStatus";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

const App = (): ReactElement => {
  const result: ReactElement = (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace={true} />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<LiveMap />} />
          <Route path="/fleet" element={<FleetStatus />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );

  return result;
};

export default App;
