import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { useTranslation } from "react-i18next";
import { InfoTooltip } from "../shared/InfoTooltip";
import { getAvailableLanguages } from "../../i18n";
import type { Theme } from "../../types";

const SettingItem = ({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <div className="flex items-center justify-between py-4 min-h-16 border-b border-border last:border-0">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {description && <InfoTooltip text={description} />}
        </div>
        <div className="flex items-center gap-4">{children}</div>
    </div>
);

interface SettingsViewProps {
    theme: Theme;
    setTheme: (t: Theme) => void;
    startMinimized: boolean;
    setStartMinimized: (v: boolean) => void;
}

export const SettingsView = ({
    theme,
    setTheme,
    startMinimized,
    setStartMinimized,
}: SettingsViewProps) => {
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-8 pb-8">
                <div>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">{t('settings.general_config')}</h2>
                    <div className="bg-card rounded-xl pl-6 pr-6 border border-border shadow-sm">
                        <SettingItem label={t('settings.language')}>
                            <Select
                                value={i18n.resolvedLanguage}
                                onValueChange={changeLanguage}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getAvailableLanguages().map((lang) => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </SettingItem>
                        <SettingItem label={t('settings.start_minimized')} description={t('settings.start_minimized_desc')}>
                            <Switch
                                checked={startMinimized}
                                onCheckedChange={(checked) => setStartMinimized(checked)}
                            />
                        </SettingItem>
                        <SettingItem label={t('settings.theme')}>
                            <Select
                                value={theme}
                                onValueChange={(value) => setTheme(value as 'dark' | 'light' | 'system')}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder={t('settings.theme_placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dark">{t('settings.theme_dark')}</SelectItem>
                                    <SelectItem value="light">{t('settings.theme_light')}</SelectItem>
                                    <SelectItem value="system">{t('settings.theme_system')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
};