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
    flmPath: string;
    setFlmPath: (path: string) => void;
    isConfigLoaded: boolean;
    saveExternalConfig: (selectedModel: string, serverOptions: ServerOptions) => void;
}

export function useConfigManager(): UseConfigManagerReturn {
    const [theme, setTheme] = useState<Theme>(DEFAULT_APP_CONFIG.theme);
    const [startMinimized, setStartMinimized] = useState<boolean>(DEFAULT_APP_CONFIG.startMinimized);
    const [flmPath, setFlmPath] = useState<string>(DEFAULT_APP_CONFIG.flmPath);
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

    const [externalSelectedModel, setExternalSelectedModel] = useState<string>("");
    const [externalServerOptions, setExternalServerOptions] = useState<ServerOptions>({});

    // Load config on startup
    useEffect(() => {
        ConfigService.loadConfig().then(async (config) => {
            setTheme(config.theme);
            setStartMinimized(config.startMinimized);

            if (!config.startMinimized) {
                const win = getCurrentWindow();
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
            const config: AppConfig = {
                theme,
                startMinimized,
                flmPath,
                lastSelectedModel: externalSelectedModel,
                serverOptions: externalServerOptions,
            };
            await ConfigService.saveConfig(config);
        };

        const timeoutId = setTimeout(saveSettings, 500);
        return () => clearTimeout(timeoutId);
    }, [theme, startMinimized, flmPath, externalSelectedModel, externalServerOptions, isConfigLoaded]);

    const saveExternalConfig = useCallback((selectedModel: string, serverOptions: ServerOptions) => {
        setExternalSelectedModel(selectedModel);
        setExternalServerOptions(serverOptions);
    }, []);

    return {
        theme,
        setTheme,
        startMinimized,
        setStartMinimized,
        flmPath,
        setFlmPath,
        isConfigLoaded,
        saveExternalConfig,
    };
}
