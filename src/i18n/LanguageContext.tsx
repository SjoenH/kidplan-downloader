import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { locale } from "@tauri-apps/plugin-os";
import { load } from "@tauri-apps/plugin-store";
import { translations, type Language } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const initLanguage = async () => {
      try {
        // Try to load saved language preference
        const store = await load("credentials.json");
        const savedLang = await store.get<Language>("language");
        
        if (savedLang === "en" || savedLang === "no") {
          setLanguageState(savedLang);
          return;
        }
        
        // Otherwise, detect system locale
        const systemLocale = await locale();
        console.log("System locale:", systemLocale);
        
        if (systemLocale?.startsWith("no") || systemLocale?.startsWith("nb") || systemLocale?.startsWith("nn")) {
          setLanguageState("no");
        } else {
          setLanguageState("en");
        }
      } catch (err) {
        console.error("Error detecting locale:", err);
        setLanguageState("en"); // fallback to English
      }
    };
    
    initLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      const store = await load("credentials.json");
      await store.set("language", lang);
      await store.save();
    } catch (err) {
      console.error("Error saving language preference:", err);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
