// 헤더: 검색창과 사용자 알림 정보를 표시합니다.
// ヘッダー：検索バーと通知情報を表示します。
// Header: Displays search bar and notification information.
import type { ReactElement, FC, ChangeEvent } from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Bell, Search, Menu, Anchor } from "lucide-react";
import {
  useShipStore,
  matchShipQuery,
  selectDisplayShips,
} from "../../store/useShipStore";
import type { ShipData } from "../../store/useShipStore";
import { useTranslation } from "react-i18next";

const SEARCH_DEBOUNCE_MS: number = 300;
const MAX_AUTOCOMPLETE_ITEMS: number = 8;

const Header: FC = (): ReactElement => {
  const { t } = useTranslation();
  const shipStore = useShipStore();
  const searchQuery: string = shipStore.searchQuery;
  const setSearchQuery = shipStore.setSearchQuery;
  const ships = useShipStore(selectDisplayShips);
  const selectShip = shipStore.selectShip;
  const setMapCenterOverride = shipStore.setMapCenterOverride;

  const [inputValue, setInputValue] = useState<string>(searchQuery);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색어 입력과 싱크 맞추기
  // 検索語入力とストアの同期
  // Sync input value with store search query.
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // 디바운스 처리된 검색 실행
  // デバウンス処理された検索実行
  // Run search with debounce.
  useEffect(() => {
    const timer: any = setTimeout(() => {
      setSearchQuery(inputValue);
    }, SEARCH_DEBOUNCE_MS);

    const cleanupFunc = () => {
      clearTimeout(timer);
    };
    return cleanupFunc;
  }, [inputValue, setSearchQuery]);

  // 자동완성 매칭 목록 (입력값 기준 즉시 필터)
  // オートコンプリート一致リスト（入力値で即時フィルタ）
  // Autocomplete match list (filter by input immediately).
  const autocompleteMatches = useMemo((): ShipData[] => {
    const q = inputValue.trim().toLowerCase();
    if (q.length === 0) return [];
    const list = Object.values(ships).filter((s) => matchShipQuery(s, inputValue));
    return list.slice(0, MAX_AUTOCOMPLETE_ITEMS);
  }, [ships, inputValue]);

  const showDropdown = isDropdownOpen && inputValue.trim().length > 0;

  const handleSelectShip = (ship: ShipData) => {
    selectShip(ship.id);
    setInputValue("");
    setSearchQuery("");
    setMapCenterOverride(ship.position.lat, ship.position.lng);
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    if (inputValue.trim().length > 0) setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    // 클릭 이벤트가 먼저 발생하도록 짧게 지연
    // クリックが先に発火するよう短く遅延
    // Short delay so click fires before closing dropdown.
    setTimeout(() => setIsDropdownOpen(false), 180);
  };

  /**
   * [KO]
   * <header(헤더)>
   *  <div(왼쪽 섹션)>
   *    <button(모바일 메뉴)>
   *    <div(검색창 영역)>
   *  </div>
   *  <div(오른쪽 섹션)>
   *    <button(알림)>
   *    <div(사용자 프로필)>
   *  </div>
   * </header>
   */
  /**
   * [JA]
   * <header(ヘッダー)>
   *  <div(左セクション)>
   *    <button(モバイルメニュー)>
   *    <div(検索バーエリア)>
   *  </div>
   *  <div(右セクション)>
   *    <button(通知)>
   *    <div(ユーザープロファイル)>
   *  </div>
   * </header>
   */
  /**
   * [EN]
   * <header(Header)>
   *  <div(Left Section)>
   *    <button(Mobile Menu)>
   *    <div(Search Bar Area)>
   *  </div>
   *  <div(Right Section)>
   *    <button(Notification)>
   *    <div(User Profile)>
   *  </div>
   * </header>
   */

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue: string = event.target.value;
    setInputValue(newValue);
    if (newValue.trim().length > 0) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const headerMarkup: ReactElement = (
    <header className="h-20 bg-slate-900/50 border-b border-white/5 flex items-center justify-between px-8 fixed top-0 right-0 left-64 z-10 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <button className="lg:hidden p-2 hover:bg-white/5 rounded-xl">
          <Menu size={24} className="text-slate-400" />
        </button>

        {/* 선박 검색 + 자동완성 (船舶検索 + オートコンプリート / Ship Search + Autocomplete) */}
        <div className="relative" ref={dropdownRef}>
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
          />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={t("searchPlaceholder")}
            className="pl-12 pr-6 py-2.5 bg-black/20 border border-white/5 rounded-xl text-sm text-white w-80 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-md max-h-72 overflow-y-auto">
              {autocompleteMatches.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-500 text-center">
                  {t("noVesselsMatch")} &quot;{inputValue.trim()}&quot;
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {autocompleteMatches.map((ship) => (
                    <li key={ship.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectShip(ship)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-indigo-500/20 transition-colors border-l-2 border-transparent hover:border-indigo-500"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                          <Anchor size={14} className="text-indigo-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">
                            {ship.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            MMSI {ship.id} · {ship.type}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {ship.speed.toFixed(1)} KN
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-3 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group">
          <Bell
            size={22}
            className="text-slate-400 group-hover:text-indigo-400"
          />
          <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
        </button>

        <div className="h-8 w-px bg-white/5 mx-2"></div>

        {/* 운영자 프로필 (オペレーター情報 / Operator Profile) */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-black text-white uppercase tracking-wider">
              {t("operator")}
            </p>
            <p className="text-[11px] text-indigo-400/70 font-bold uppercase">
              {t("busanPortControl")}
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 font-black shadow-lg">
            {t("operatorShort")}
          </div>
        </div>
      </div>
    </header>
  );

  return headerMarkup;
};

export default Header;
