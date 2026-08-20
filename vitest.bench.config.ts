// 성능 벤치마크 전용 설정 — npm test에는 포함되지 않는다 (실행: npm run bench).
// Benchmark-only config, excluded from npm test. Run with: npm run bench.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["bench/**/*.bench.ts"],
    // 측정 로그를 그대로 보여준다.
    silent: false,
  },
});
