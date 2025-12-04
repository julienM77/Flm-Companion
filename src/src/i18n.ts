import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files dynamically at build time
const translationModules = import.meta.glob('./locales/*/translation.json', { eager: true }) as Record<string, { default?: Record<string, unknown> } & Record<string, unknown>>;

// Language metadata interface
export interface LanguageMeta {
    code: string;
    name: string;
    default?: boolean;
}

// Parse translations and extract metadata
const resources: Record<string, { translation: Record<string, unknown> }> = {};
const availableLanguages: LanguageMeta[] = [];
let defaultLanguage = 'en';

for (const [path, module] of Object.entries(translationModules)) {
    // Extract language code from path: ../public/locales/XX/translation.json
    const match = path.match(/\/locales\/([^/]+)\/translation\.json$/);
    if (match) {
        const langCode = match[1];
        const translations = (module.default || module) as Record<string, unknown>;
        const meta = translations._meta as LanguageMeta | undefined;

        // Build resources object (exclude _meta from translations)
        const { _meta, ...translationData } = translations;
        resources[langCode] = { translation: translationData };

        // Build available languages list
        if (meta) {
            availableLanguages.push({
                code: meta.code || langCode,
                name: meta.name || langCode,
                default: meta.default,
            });

            if (meta.default) {
                defaultLanguage = langCode;
            }
        } else {
            availableLanguages.push({ code: langCode, name: langCode });
        }
    }
}

// Sort languages alphabetically by name
availableLanguages.sort((a, b) => a.name.localeCompare(b.name));

// Export for use in settings
export const getAvailableLanguages = (): LanguageMeta[] => availableLanguages;
export const getDefaultLanguage = (): string => defaultLanguage;

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        supportedLngs: availableLanguages.map(l => l.code),
        fallbackLng: defaultLanguage,
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

export default i18n;
