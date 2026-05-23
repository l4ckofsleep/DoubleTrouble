import { createContext, useContext, useState, useCallback } from 'react';
import ruDict from './locales/ru';
import enDict from './locales/en';

export type Language = 'ru' | 'en';

const STORAGE_KEY = 'dt_language';

export const translations: Record<Language, Record<string, string>> = {
  ru: ruDict as unknown as Record<string, string>,
  en: enDict as unknown as Record<string, string>,
};

export function useLocale() {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en') return 'en';
    return 'ru';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let result = translations[language][key];
      if (result === undefined) result = translations.ru[key];
      if (result === undefined) return key;
      if (vars) {
        result = result.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
      }
      return result;
    },
    [language],
  );

  return { language, setLanguage, t };
}

export type LocaleContextValue = ReturnType<typeof useLocale>;

export const LocaleContext = createContext<LocaleContextValue>({
  language: 'ru',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const value = useLocale();
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
