import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useConfigManager } from "../hooks/useConfigManager";
import { useModelsManager } from "../hooks/useModelsManager";
import { useServerManager } from "../hooks/useServerManager";
import { useTrayMenu } from "../hooks/useTrayMenu";
import { ConfigService } from "../services/config";
import type { Theme, ServerStatus, ServerOptions, FlmModel, HardwareInfo } from "../types";

interface AppContextType {
    // Config
    theme: Theme;
    setTheme: (theme: Theme) => void;
    startMinimized: boolean;
    setStartMinimized: (value: boolean) => void;
    flmPath: string;
    setFlmPath: (path: string) => void;
    isConfigLoaded: boolean;

    // Models
    installedModels: FlmModel[];
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    hardwareInfo: HardwareInfo | null;
    loadInstalledModels: (force?: boolean) => void;
    loadHardwareInfo: (force?: boolean) => Promise<void>;

    // Server
    serverStatus: ServerStatus;
    logs: string[];
    serverOptions: ServerOptions;
    setServerOptions: (options: ServerOptions | ((prev: ServerOptions) => ServerOptions)) => void;
    handleToggleServer: (options?: ServerOptions) => Promise<void>;
    addLog: (log: string) => void;

    // Navigation
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
    children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
    const [activeTab, setActiveTab] = useState("models");
    const [initialServerOptions, setInitialServerOptions] = useState<ServerOptions>({});
    const [initialSelectedModel, setInitialSelectedModel] = useState<string>("");

    // Config manager
    const config = useConfigManager();

    // Load initial values from config
    useEffect(() => {
        if (config.isConfigLoaded) {
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
        installedModels: models.installedModels,
        initialServerOptions,
        isConfigLoaded: config.isConfigLoaded,
        onNavigateToLogs: () => setActiveTab("server"),
    });

    // Tray menu sync
    useTrayMenu({
        serverStatus: server.serverStatus,
        selectedModel: models.selectedModel,
        installedModels: models.installedModels,
        serverOptions: server.serverOptions,
    });

    // Save config when external values change
    useEffect(() => {
        if (config.isConfigLoaded) {
            config.saveExternalConfig(models.selectedModel, server.serverOptions);
        }
    }, [models.selectedModel, server.serverOptions, config.isConfigLoaded]);

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
        selectedModel: models.selectedModel,
        setSelectedModel: models.setSelectedModel,
        hardwareInfo: models.hardwareInfo,
        loadInstalledModels: models.loadInstalledModels,
        loadHardwareInfo: models.loadHardwareInfo,

        // Server
        serverStatus: server.serverStatus,
        logs: server.logs,
        serverOptions: server.serverOptions,
        setServerOptions: server.setServerOptions,
        handleToggleServer: server.handleToggleServer,
        addLog: server.addLog,

        // Navigation
        activeTab,
        setActiveTab,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}
