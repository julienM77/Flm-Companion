import { useState, useEffect, useCallback } from "react";
import { ConfigService } from "../services/config";
import { FlmService } from "../services/flm";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme, AppConfig, ServerOptions } from "../types";
import { DEFAULT_APP_CONFIG } from "../types";

interface UseConfigManagerReturn {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    startMinimized: boolean;
    setStartMinimized: (value: boolean) => void;
    startServerOnLaunch: boolean;
    setStartServerOnLaunch: (value: boolean) => void;
    stopServerOnExit: boolean;
    setStopServerOnExit: (value: boolean) => void;
    flmPath: string;
    setFlmPath: (path: string) => void;
    isConfigLoaded: boolean;
    saveExternalConfig: (selectedModel: string, serverOptions: ServerOptions) => void;
}

export function useConfigManager(): UseConfigManagerReturn {
    const [theme, setTheme] = useState<Theme>(DEFAULT_APP_CONFIG.theme);
    const [startMinimized, setStartMinimized] = useState<boolean>(DEFAULT_APP_CONFIG.startMinimized);
    const [startServerOnLaunch, setStartServerOnLaunch] = useState<boolean>(DEFAULT_APP_CONFIG.startServerOnLaunch);
    const [stopServerOnExit, setStopServerOnExit] = useState<boolean>(DEFAULT_APP_CONFIG.stopServerOnExit);
    const [flmPath, setFlmPath] = useState<string>(DEFAULT_APP_CONFIG.flmPath);
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

    const [externalSelectedModel, setExternalSelectedModel] = useState<string>("");
    const [externalServerOptions, setExternalServerOptions] = useState<ServerOptions>({});

    // Persist launch preferences immediately as well as through the normal
    // config save. This avoids losing a switch change if the app exits before
    // the debounced save below runs.
    const persistLaunchPreference = useCallback((patch: Partial<AppConfig>) => {
        void ConfigService.updateConfig(patch).catch((error) => {
            console.error("Failed to save launch preference:", error);
        });
    }, []);
    const updateStartMinimized = useCallback((value: boolean) => {
        setStartMinimized(value);
        persistLaunchPreference({ startMinimized: value });
    }, [persistLaunchPreference]);
    const updateStartServerOnLaunch = useCallback((value: boolean) => {
        setStartServerOnLaunch(value);
        persistLaunchPreference({ startServerOnLaunch: value });
    }, [persistLaunchPreference]);

    // Load config on startup
    useEffect(() => {
        ConfigService.loadConfig().then(async (config) => {
            setTheme(config.theme);
            setStartMinimized(config.startMinimized);
            setStartServerOnLaunch(config.startServerOnLaunch);
            setStopServerOnExit(config.stopServerOnExit);

            const win = getCurrentWindow();
            if (config.startMinimized) {
                await win.hide();
            } else {
                await win.unminimize();
                await win.show();
                await win.setFocus();
            }

            let path = config.flmPath;
            if (path === "flm" || path === "" || path === null) {
                const resolvedPath = await FlmService.findFlmPath();
                if (resolvedPath) {
                    console.log("Resolved FLM path from system:", resolvedPath);
                    path = resolvedPath;
                }
            }

            setFlmPath(path);
            setExternalSelectedModel(config.lastSelectedModel || "");
            setExternalServerOptions(config.serverOptions || {});
            setIsConfigLoaded(true);
        });
    }, []);

    // Apply theme to document
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    // Save config when settings change
    useEffect(() => {
        if (!isConfigLoaded) return;

        const saveSettings = async () => {
            // Load current config to preserve presetsConfig
            const currentConfig = await ConfigService.loadConfig();
            
            const config: AppConfig = {
                theme,
                startMinimized,
                startServerOnLaunch,
                stopServerOnExit,
                flmPath,
                lastSelectedModel: externalSelectedModel,
                serverOptions: externalServerOptions,
                presetsConfig: currentConfig.presetsConfig, // Preserve presets
            };
            await ConfigService.saveConfig(config);
        };

        const timeoutId = setTimeout(() => {
            void saveSettings().catch((error) => console.error("Failed to save settings:", error));
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [theme, startMinimized, startServerOnLaunch, stopServerOnExit, flmPath, externalSelectedModel, externalServerOptions, isConfigLoaded]);

    const saveExternalConfig = useCallback((selectedModel: string, serverOptions: ServerOptions) => {
        setExternalSelectedModel(selectedModel);
        setExternalServerOptions(serverOptions);
    }, []);

    return {
        theme,
        setTheme,
        startMinimized,
        setStartMinimized: updateStartMinimized,
        startServerOnLaunch,
        setStartServerOnLaunch: updateStartServerOnLaunch,
        stopServerOnExit,
        setStopServerOnExit,
        flmPath,
        setFlmPath,
        isConfigLoaded,
        saveExternalConfig,
    };
}
