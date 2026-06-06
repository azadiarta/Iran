import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'en' | 'fa';

interface LangState {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
}

const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      locale: 'en',
      dir: 'ltr',

      setLocale: (locale) => {
        const dir = locale === 'fa' ? 'rtl' : 'ltr';

        set({ locale, dir });

        // Update localStorage key used by API layer for redirect prefixes
        if (typeof window !== 'undefined') {
          localStorage.setItem('lang', locale);
          document.documentElement.dir = dir;
          document.documentElement.lang = locale;
        }
      },
    }),
    {
      name: 'groupfund-lang',
      partialize: (state) => ({
        locale: state.locale,
        dir: state.dir,
      }),
    }
  )
);

export default useLangStore;
