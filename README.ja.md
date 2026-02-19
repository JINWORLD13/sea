# Language Selection / 언어 선택 / 言語選択

ようこそ！ドキュメントを閲覧するには、ご希望의 言語を選択してください：

- [English](README.md)
- [한국어](README.ko.md)
- **[日本語](README.ja.md)**

---

# AI Maritime Monitoring & Digital Twin System

海上船舶モニタリングおよびデジタルツインインターフェースプロジェクトです。

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-4.0-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r149-black?logo=three.js&logoColor=white)
![Zustand](https://img.shields.io/badge/State_Management-Zustand-orange)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚢 プロジェクト概要

このプロジェクトは、自律航行および海洋AI認識技術に基づいたリアルタイム船舶モニタリングシステムです。AIS（Automatic Identification System）データを活用して船舶の位置を視認化し、IoTセンサーデータを同期して船舶の状態をリアルタイムで表示するデジタルツイン環境を構築します。

## 🌟 主要機能

1. **リアルタイムAISマップインターフェース**
   - 船舶のHeadingデータに基づいたカスタムマーカー回転システム
   - 過去の座標データを活用した船舶経路の予測および視認化

2. **デジタルツイン3Dビュー**
   - Three.jsおよびReact Three Fiberを使用した高精度な3D船舶レンダリング
   - WebSocketを通じたPitchおよびRollデータの同期によるリアルタイム挙動シミュレーション

3. **高性能な状態管理**
   - Zustandを活用し、秒間数十件のAISストリームデータを効率的に処理
   - 変更されたデータのみを更新する最適化ロジックの適用

4. **グローバル対応**
   - i18nextを活用した韓国語、英語、日本語の多言語対応

## 🛠 技術スタック

- **フレームワーク**: React 19, TypeScript, Vite
- **状態管理**: Zustand
- **視覚化**:
  - **Map**: Leaflet, React-Leaflet
  - **3D**: Three.js, @react-three/fiber, @react-three/drei
- **スタイリング**: Tailwind CSS, Lucide React
- **通信**: WebSocket (AISStream API)

## 📂 プロジェクト構造

```text
seadronix/
├── src/
│   ├── components/
│   │   ├── 3d/           # Three.js / React Three Fiber (Ship, Scene)
│   │   ├── dashboard/   # ModeSwitcher, StatsBar, Alerts
│   │   ├── layout/      # アプリレイアウト、Sidebar、Header
│   │   └── map/         # Leaflet マップおよび船舶マーカー
│   ├── store/            # Zustand (船舶、CPA/ジオフェンシング、tick)
│   ├── utils/            # 海上数学 (CPA, latLngToXY, cogSogToVelocity)
│   ├── constants/        # 翻訳(i18n)、海域、目的港リスト
│   ├── i18n.ts           # i18next 設定および言語検出
│   └── pages/            # Dashboard, LiveMap, FleetStatus, Analytics, Settings
├── public/
└── .env                  # VITE_AISSTREAM_API_KEY (オプション、リアルタイムAIS用)
```

## 🚀 スタートガイド

1. リポジトリをクローンします。

   ```bash
   git clone https://github.com/JINWORLD13/sea.git
   ```

2. 依存関係をインストールします。

   ```bash
   npm install
   ```

3. 環境変数を設定します. (.env)

   ```
   VITE_AISSTREAM_API_KEY=your_api_key_here
   ```

### データフロー

**フロント ↔ プロキシサーバー ↔ AISStream** — WebSocket双方向通信。フロントから購読リクエスト（例：BoundingBoxes）をサーバーに送ると、サーバーがAISStreamへ転送し、AISデータはAISStream → サーバー → フロントへストリーミングされます。

## 💡 技術的課題と解決策

### 1. 高頻度 WebSocket データの処理最適化

- **課題**: 大量のAISデータ（数百隻の船舶）がリアルタイムで流入する際、マップマーカーのちらつきや全体のパフォーマンス低下が発生。
- **解決策**:
  - **Throttled Updates**: Zustand ストア内にスロットリングメカニズムを実装し、状態更新の頻度を制御しました。
  - **Threshold フィルタリング**: 船舶の移動距離がしきい値（例：0.5m）未満の場合、不要な状態更新をスキップするようにロジックを設計しました。
  - **コンポーネントの分離**: 画面全体の再レンダリングを防ぐため、3Dキャンバスとマップレイヤーを独立したコンテキストに隔離しました。

### 2. 精密な 3D デジタルツイン同期

- **課題**: センサーから受信する Pitch/Roll/Heading データを、3Dモデルに途切れることなくスムーズに反映させる必要。
- **解決策**:
  - **Lerp 補間**: `MathUtils.lerp` および `Slerp` を使用して、角度の変化を視覚的に滑らかに繋ぎました。
  - **海上数学の活用**: COG（Course Over Ground）および SOG（Speed Over Ground）データを基に予測位置を計算するユーティリティを開発しました。

## 🚀 今後のロードマップ

- [ ] 過去のAISデータ再生機能（Playback）の統合
- [ ] ブリッジシミュレーター向け VR/AR 対応の拡張
