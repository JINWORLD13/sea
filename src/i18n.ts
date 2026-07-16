import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { translations } from "./constants/translations";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: translations.en },
      ko: { translation: translations.ko },
      ja: { translation: translations.ja },
    },
    fallbackLng: "ko",
    // 지원 언어를 en/ko/ja로 한정하고 지역코드(en-US 등)는 기본 언어로 축약.
    // Restrict to en/ko/ja and collapse region codes (e.g. en-US → en) so the
    // detector never resolves to a language without resources.
    supportedLngs: ["en", "ko", "ja"],
    load: "languageOnly",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
