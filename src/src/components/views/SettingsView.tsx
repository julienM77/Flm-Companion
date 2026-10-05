import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { InfoTooltip } from "../shared/InfoTooltip";
import { getAvailableLanguages } from "../../i18n";
import type { FlmModel, ServerOptions, ServerStatus, Theme } from "../../types";
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { invoke } from '@tauri-apps/api/core';
import { Check, Copy, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface OpencodeIntegrationResult {
    installed: boolean;
    configured: boolean;
    wroteConfig: boolean;
    configPath: string;
    snippet: string;
    error?: string;
}

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
    startServerOnLaunch: boolean;
    setStartServerOnLaunch: (v: boolean) => void;
    stopServerOnExit: boolean;
    setStopServerOnExit: (v: boolean) => void;
    serverStatus: ServerStatus;
    serverOptions: ServerOptions;
    models: FlmModel[];
    selectedModel: string;
}

export const SettingsView = ({
    theme,
    setTheme,
    startMinimized,
    setStartMinimized,
    startServerOnLaunch,
    setStartServerOnLaunch,
    stopServerOnExit,
    setStopServerOnExit,
    serverStatus,
    serverOptions,
    models,
    selectedModel,
}: SettingsViewProps) => {
    const { t, i18n } = useTranslation();
    const [autostartEnabled, setAutostartEnabled] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedConfig, setCopiedConfig] = useState(false);
    const [opencode, setOpencode] = useState<OpencodeIntegrationResult | null>(null);
    const [opencodeLoading, setOpencodeLoading] = useState(false);

    const serverUrl = useMemo(() => {
        const configuredHost = serverOptions.host || "127.0.0.1";
        const connectHost = ["0.0.0.0", "::", "[::]"].includes(configuredHost)
            ? "127.0.0.1"
            : configuredHost;
        const displayHost = connectHost.includes(":") && !connectHost.startsWith("[")
            ? `[${connectHost}]`
            : connectHost;
        return `http://${displayHost}:${serverOptions.port || 52625}/v1`;
    }, [serverOptions.host, serverOptions.port]);

    const modelNames = useMemo(() => {
        const names = models.map((model) => model.name);
        if (selectedModel && !selectedModel.startsWith("preset:") && !names.includes(selectedModel)) {
            names.unshift(selectedModel);
        }
        return names;
    }, [models, selectedModel]);

    useEffect(() => {
        isEnabled().then(setAutostartEnabled).catch(console.error);
    }, []);

    useEffect(() => {
        invoke<OpencodeIntegrationResult>("configure_opencode", {
            request: { baseUrl: serverUrl, models: modelNames, write: false },
        }).then(setOpencode).catch((error) => {
            console.error("Failed to inspect OpenCode integration:", error);
        });
    }, [serverUrl, modelNames]);

    const toggleAutostart = async (checked: boolean) => {
        try {
            if (checked) {
                await enable();
            } else {
                await disable();
            }
            setAutostartEnabled(checked);
        } catch (error) {
            console.error('Failed to toggle autostart:', error);
        }
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const copyText = async (text: string, setCopied: (value: boolean) => void) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const configureOpencode = async () => {
        setOpencodeLoading(true);
        try {
            const result = await invoke<OpencodeIntegrationResult>("configure_opencode", {
                request: { baseUrl: serverUrl, models: modelNames, write: true },
            });
            setOpencode(result);
        } catch (error) {
            console.error("Failed to configure OpenCode:", error);
        } finally {
            setOpencodeLoading(false);
        }
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
                        <SettingItem label={t('settings.autostart')} description={t('settings.autostart_desc')}>
                            <Switch
                                checked={autostartEnabled}
                                onCheckedChange={toggleAutostart}
                            />
                        </SettingItem>
                        <SettingItem label={t('settings.start_server_on_launch')} description={t('settings.start_server_on_launch_desc')}>
                            <Switch
                                checked={startServerOnLaunch}
                                onCheckedChange={setStartServerOnLaunch}
                            />
                        </SettingItem>
                        <SettingItem label={t('settings.stop_server_on_exit')} description={t('settings.stop_server_on_exit_desc')}>
                            <Switch
                                checked={stopServerOnExit}
                                onCheckedChange={setStopServerOnExit}
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

                <div>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">{t('settings.local_integrations')}</h2>
                    <div className="bg-card rounded-xl pl-6 pr-6 border border-border shadow-sm">
                        <SettingItem label={t('settings.server_url')} description={t('settings.server_url_desc')}>
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${serverStatus === "running" ? "bg-green-500" : "bg-zinc-500"}`} />
                                <code className="text-xs text-muted-foreground select-all">{serverUrl}</code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyText(serverUrl, setCopiedUrl)}
                                    title={t('settings.copy_url')}
                                >
                                    {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                                </Button>
                            </div>
                        </SettingItem>

                        <SettingItem label={t('settings.opencode')} description={t('settings.opencode_desc')}>
                            <Button
                                variant="outline"
                                onClick={configureOpencode}
                                disabled={opencodeLoading || !opencode?.installed || Boolean(opencode?.error) || modelNames.length === 0}
                            >
                                <PlugZap size={16} className="mr-2" />
                                {opencodeLoading
                                    ? t('settings.opencode_working')
                                    : opencode?.configured
                                        ? t('settings.opencode_update')
                                        : t('settings.opencode_add')}
                            </Button>
                        </SettingItem>

                        {opencode && (
                            <div className="pb-5 space-y-3">
                                <p className={`text-xs ${opencode.error ? "text-red-500" : "text-muted-foreground"}`}>
                                    {opencode.error
                                        ? opencode.error
                                        : opencode.wroteConfig
                                            ? t('settings.opencode_saved', { path: opencode.configPath })
                                            : opencode.installed
                                                ? t('settings.opencode_detected', { path: opencode.configPath, count: modelNames.length })
                                                : t('settings.opencode_not_found')}
                                </p>

                                {(!opencode.installed || Boolean(opencode.error)) && (
                                    <div className="rounded-lg border border-border bg-muted/60 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-medium">{t('settings.opencode_manual_config')}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyText(opencode.snippet, setCopiedConfig)}
                                            >
                                                {copiedConfig ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                                                {copiedConfig ? t('settings.copied') : t('settings.copy_config')}
                                            </Button>
                                        </div>
                                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">{opencode.snippet}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
};
