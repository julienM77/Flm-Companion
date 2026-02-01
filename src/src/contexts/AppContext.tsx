// @refresh reset
import { useState, useEffect, useCallback, ReactNode } from "react";
import { useConfigManager } from "../hooks/useConfigManager";
import { useModelsManager } from "../hooks/useModelsManager";
import { useServerManager } from "../hooks/useServerManager";
import { useTrayMenu } from "../hooks/useTrayMenu";
import { ConfigService } from "../services/config";
import { FlmService, setFlmAvailability } from "../services/flm";
import { NotificationService } from "../services/notification";
import { StartupService, type StartupCheckResult } from "../services/startup";
import type { ServerOptions } from "../types";
import { AppContext, type AppContextType } from "./AppContextDefinition";

interface AppProviderProps {
    children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
    const [activeTab, setActiveTab] = useState("models");
    const [initialServerOptions, setInitialServerOptions] = useState<ServerOptions>({});
    const [initialSelectedModel, setInitialSelectedModel] = useState<string>("");
    const [flmVersion, setFlmVersion] = useState<string>("");
    const [startupChecks, setStartupChecks] = useState<StartupCheckResult | null>(null);
    const [isCheckingStartup, setIsCheckingStartup] = useState(false);
    const [isFlmAvailable, setIsFlmAvailable] = useState(false);

    // Config manager
    const config = useConfigManager();

    // Load FLM version
    const loadFlmVersion = useCallback(async (force = false) => {
        if (!force && flmVersion) return; // Cache if already loaded
        try {
            const ver = await FlmService.getVersion();
            if (ver && ver !== "Not Found" && ver !== "Unknown") {
                setFlmVersion(ver);
            }
        } catch {
            setFlmVersion("Unknown");
        }
    }, [flmVersion]);

    // Load FLM version on mount
    useEffect(() => {
        loadFlmVersion();
    }, [loadFlmVersion]);

    // Perform startup checks
    const performChecks = useCallback(async () => {
        setIsCheckingStartup(true);
        try {
            const checks = await StartupService.performStartupChecks();
            setStartupChecks(checks);

            // Update FLM version if found
            if (checks.flmInstalled && checks.flmVersion) {
                setFlmVersion(checks.flmVersion);
            }

            // Set global FLM availability flag
            const isAvailable = checks.flmInstalled && checks.flmVersionValid;
            setIsFlmAvailable(isAvailable);
            setFlmAvailability(isAvailable); // Inform FlmService
        } catch (error) {
            console.error("Error performing startup checks:", error);
            setIsFlmAvailable(false);
            setFlmAvailability(false); // Inform FlmService
        } finally {
            setIsCheckingStartup(false);
        }
    }, []);

    // Run startup checks on mount
    useEffect(() => {
        performChecks();
    }, [performChecks]);

    // Load initial values from config and initialize notification service
    useEffect(() => {
        if (config.isConfigLoaded) {
            // Initialize notification permissions
            NotificationService.init();

            ConfigService.loadConfig().then((loadedConfig) => {
                setInitialServerOptions(loadedConfig.serverOptions || {});
                setInitialSelectedModel(loadedConfig.lastSelectedModel || "");
            });
        }
    }, [config.isConfigLoaded]);

    // Models manager
    const models = useModelsManager({
        flmPath: config.flmPath,
        isConfigLoaded: config.isConfigLoaded,
        initialSelectedModel,
    });

    // Server manager
    const server = useServerManager({
        selectedModel: models.selectedModel,
        setSelectedModel: models.setSelectedModel,
        installedModels: models.runnableModels,
        initialServerOptions,
        isConfigLoaded: config.isConfigLoaded,
        onNavigateToLogs: () => setActiveTab("server"),
    });

    // Tray menu sync
    useTrayMenu({
        serverStatus: server.serverStatus,
        selectedModel: models.selectedModel,
        installedModels: models.installedModels,
        availableModels: models.availableModels,
        runnableModels: models.runnableModels,
        serverOptions: server.serverOptions,
        flmVersion: flmVersion,
        isFlmAvailable: isFlmAvailable,
    });

    // Save config when external values change
    useEffect(() => {
        if (config.isConfigLoaded) {
            config.saveExternalConfig(models.selectedModel, server.serverOptions);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [models.selectedModel, server.serverOptions, config.isConfigLoaded, config.saveExternalConfig]);

    const value: AppContextType = {
        // Config
        theme: config.theme,
        setTheme: config.setTheme,
        startMinimized: config.startMinimized,
        setStartMinimized: config.setStartMinimized,
        flmPath: config.flmPath,
        setFlmPath: config.setFlmPath,
        isConfigLoaded: config.isConfigLoaded,

        // Models
        installedModels: models.installedModels,
        runnableModels: models.runnableModels,
        selectedModel: models.selectedModel,
        setSelectedModel: models.setSelectedModel,
        hardwareInfo: models.hardwareInfo,
        loadInstalledModels: models.loadInstalledModels,
        loadHardwareInfo: models.loadHardwareInfo,

        // FLM Version
        flmVersion,
        loadFlmVersion,

        // Server
        serverStatus: server.serverStatus,
        logs: server.logs,
        serverOptions: server.serverOptions,
        setServerOptions: server.setServerOptions,
        handleToggleServer: server.handleToggleServer,
        addLog: server.addLog,
        clearLogs: server.clearLogs,

        // Navigation
        activeTab,
        setActiveTab,

        // Startup checks
        startupChecks,
        isCheckingStartup,
        isFlmAvailable,
        reloadStartupChecks: performChecks,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
