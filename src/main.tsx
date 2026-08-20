import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { useShipStore } from './store/useShipStore'

// 개발 모드 한정: 성능 계측(FPS·초당 수신 메시지·set 횟수)을 콘솔에서 할 수
// 있도록 스토어를 노출한다. 프로덕션 번들에는 포함되지 않는다.
// DEV only: expose the store for perf measurements from the console
// (FPS, msgs/s, set() rate). Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__shipStore = useShipStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
