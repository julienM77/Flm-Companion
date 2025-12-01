import { Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { useTranslation } from "react-i18next";

const SettingItem = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4 min-h-16 border-b border-border last:border-0">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {description && (
                <div className="group relative">
                    <Info size={14} className="text-muted-foreground cursor-help" />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 w-48 p-2 bg-popover border border-border rounded text-xs text-popover-foreground opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-md">
                        {description}
                    </div>
                </div>
            )}
        </div>
        <div className="flex items-center gap-4">
            {children}
        </div>
    </div>
);

export const SettingsView = ({ theme, setTheme }: {
    theme: "dark" | "light" | "system",
    setTheme: (t: "dark" | "light" | "system") => void
}) => {
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
                                value={i18n.language}
                                onValueChange={changeLanguage}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fr">Français</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>
                        {/*<SettingItem label={t('settings.start_minimized')} description={t('settings.start_minimized_desc')}>
                            <Switch />
                        </SettingItem>
                        <SettingItem label={t('settings.start_on_boot')} description={t('settings.start_on_boot_desc')}>
                            <Switch defaultChecked />
                        </SettingItem>*/}
                        <SettingItem label={t('settings.theme')}>
                            <Select
                                value={theme}
                                onValueChange={(value) => setTheme(value as any)}
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

                {/* Path selection removed as we rely on system PATH and auto-detection */}
            </div>
        </ScrollArea>
    );
};