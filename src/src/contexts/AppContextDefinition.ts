import { createContext } from "react";
import type { Theme, ServerStatus, ServerOptions, FlmModel, HardwareInfo } from "../types";
import type { StartupCheckResult } from "../services/startup";

export interface AppContextType {
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
    runnableModels: FlmModel[];
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    hardwareInfo: HardwareInfo | null;
    loadInstalledModels: (force?: boolean) => void;
    loadHardwareInfo: (force?: boolean) => Promise<void>;

    // FLM Version
    flmVersion: string;
    loadFlmVersion: (force?: boolean) => Promise<void>;

    // Server
    serverStatus: ServerStatus;
    logs: string[];
    serverOptions: ServerOptions;
    setServerOptions: (options: ServerOptions | ((prev: ServerOptions) => ServerOptions)) => void;
    handleToggleServer: (options?: ServerOptions) => Promise<void>;
    addLog: (log: string) => void;
    clearLogs: () => void;

    // Navigation
    activeTab: string;
    setActiveTab: (tab: string) => void;

    // Startup checks
    startupChecks: StartupCheckResult | null;
    isCheckingStartup: boolean;
    isFlmAvailable: boolean;  // Global flag indicating if FLM is installed and usable
    reloadStartupChecks: () => Promise<void>;  // Reloads startup checks
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
