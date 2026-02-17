import type { ReactElement, FC } from "react";
import { Bell, Shield, User } from "lucide-react";
import { useTranslation } from "react-i18next";

const Settings: FC = (): ReactElement => {
  const { t } = useTranslation();
  /**
   * [KO]
   * <div(컨테이너)>
   *  <h2>제목</h2>
   *  <div(설정 목록 카드)>
   *    <div(계정 프로필 섹션)>
   *    <div(알림 설정 섹션)>
   *    <div(보안 설정 섹션)>
   *  </div>
   * </div>
   */
  /**
   * [JA]
   * <div(コンテナ)>
   *  <h2>タイトル</h2>
   *  <div(設定リストカード)>
   *    <div(アカウントプロファイルセクション)>
   *    <div(通知設定セクション)>
   *    <div(セキュリティ設定セクション)>
   *  </div>
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <h2>Title</h2>
   *  <div(Settings List Card)>
   *    <div(Account Profile Section)>
   *    <div(Notifications Section)>
   *    <div(Security Section)>
   *  </div>
   * </div>
   */
  const settingsMarkup: ReactElement = (
    <div className="space-y-6 max-w-2xl">
      <title>{t("settingsTitle")} - {t("appName")}</title>
      <h2 className="text-2xl font-bold text-slate-800">{t("settingsTitle")}</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
        <div className="p-4 flex items-center justify-between hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-800">{t("accountProfile")}</h3>
              <p className="text-sm text-slate-500">{t("manageAccountInfo")}</p>
            </div>
          </div>
          <button className="text-sm text-blue-600 font-medium">{t("edit")}</button>
        </div>

        <div className="p-4 flex items-center justify-between hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-800">{t("notifications")}</h3>
              <p className="text-sm text-slate-500">
                {t("configureAlertPrefs")}
              </p>
            </div>
          </div>
          <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-800">{t("security")}</h3>
              <p className="text-sm text-slate-500">{t("password2fa")}</p>
            </div>
          </div>
          <button className="text-sm text-blue-600 font-medium">{t("manage")}</button>
        </div>
      </div>
    </div>
  );

  return settingsMarkup;
};

export default Settings;
