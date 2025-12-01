import { useState, useEffect } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { Models } from "./components/Models";
import { ServerView } from "./components/ServerView";
import { SettingsView } from "./components/SettingsView";
import { AboutView } from "./components/AboutView";
import { StatusBar } from "./components/StatusBar";
import { FlmService, FlmModel, ServerOptions, HardwareInfo } from "./services/flm";
import { ConfigService, AppConfig } from "./services/config";
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { useTranslation } from "react-i18next";

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("models");
  const [serverStatus, setServerStatus] = useState<"stopped" | "running" | "starting">("stopped");
  const [logs, setLogs] = useState<string[]>([]);
  const [installedModels, setInstalledModels] = useState<FlmModel[]>([]);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [serverOptions, setServerOptions] = useState<ServerOptions>({
    pmode: 'performance',
    port: 52625,
    ctxLen: 0,
    asr: false,
    embed: false,
    socket: 10,
    qLen: 10,
    cors: true,
    preemption: false
  });
  const [flmPath, setFlmPath] = useState("flm");

  // Load config on startup
  useEffect(() => {
    ConfigService.loadConfig().then(async config => {
      setTheme(config.theme);

      let path = config.flmPath;
      if (path === "flm" || path === "" || path === null) {
        const resolvedPath = await FlmService.findFlmPath();
        if (resolvedPath) {
          console.log("Resolved FLM path from system:", resolvedPath);
          path = resolvedPath;
        }
      }

      setFlmPath(path);

      if (config.lastSelectedModel) {
        setSelectedModel(config.lastSelectedModel);
      }
      if (config.serverOptions) {
        setServerOptions(config.serverOptions);
      }
    });
  }, []);

  // Save config when settings change
  useEffect(() => {
    const saveSettings = async () => {
      const config: AppConfig = {
        theme,
        flmPath,
        lastSelectedModel: selectedModel,
        serverOptions
      };
      await ConfigService.saveConfig(config);
    };

    // Debounce saving slightly to avoid too many writes
    const timeoutId = setTimeout(saveSettings, 500);
    return () => clearTimeout(timeoutId);
  }, [theme, flmPath, selectedModel, serverOptions]);

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

  const loadInstalledModels = (force = false) => {
    FlmService.listModels('installed', force).then(models => {
      setInstalledModels(models);
      setSelectedModel(prev => {
        if (prev && models.some(m => m.name === prev)) return prev;
        return models.length > 0 ? models[0].name : "";
      });
    });
  };

  const loadHardwareInfo = async (force = false) => {
    const info = await FlmService.getHardwareInfo(force);
    setHardwareInfo(info);
  };

  // Load initial data
  useEffect(() => {
    // Request notification permission
    (async () => {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
    })();

    loadInstalledModels();
    loadHardwareInfo();
  }, [flmPath]); // Reload models when path changes

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  const handleToggleServer = async (options?: ServerOptions) => {
    if (serverStatus === "running") {
      try {
        await FlmService.stopServer(addLog);
      } catch (error) {
        addLog(t('app.log_stop_error', { error }));
      }
    } else {
      setServerStatus("starting");
      setLogs([]);
      addLog(t('app.log_starting_server', { model: selectedModel || "None" }));

      try {
        // Use provided options or defaults if called from dashboard (which passes no args)
        const optionsToUse = options || serverOptions;

        await FlmService.startServer(selectedModel, optionsToUse, (log) => {
          addLog(log);
          // Check for the specific line indicating the server is ready
          if (log.includes("Enter 'exit' to stop the server:")) {
            setServerStatus("running");
            sendNotification({
              title: t('app.notification_server_started_title'),
              body: t('app.notification_server_started_body', { model: selectedModel || "None" }),
            });
          }
          // Check if server stopped (crashed or exited)
          if (log.includes("[SYSTEM] Server stopped with code")) {
            setServerStatus("stopped");
            if (!log.includes("code 0")) {
              sendNotification({
                title: t('app.notification_server_error_title'),
                body: t('app.notification_server_error_body'),
              });
            } else {
              sendNotification({
                title: t('app.notification_server_stopped_title'),
                body: t('app.notification_server_stopped_body'),
              });
            }
          }
        });
      } catch (error) {
        setServerStatus("stopped");
        addLog(t('app.log_start_error', { error }));
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "chat":
        return (
          <ChatView
            models={installedModels}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            options={serverOptions}
            setOptions={setServerOptions}
          />
        );
      case "server":
        return (
          <ServerView
            serverStatus={serverStatus}
            onToggleServer={handleToggleServer}
            models={installedModels}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            logs={logs}
            options={serverOptions}
            setOptions={setServerOptions}
          />
        );
      case "models":
        return <Models installedModels={installedModels} onRefresh={() => loadInstalledModels(true)} hardwareInfo={hardwareInfo} />;
      case "settings":
        return <SettingsView theme={theme} setTheme={setTheme} />;
      case "about":
        return <AboutView hardwareInfo={hardwareInfo} onRefreshHardware={() => loadHardwareInfo(true)} />;
      default:
        return (
          <ChatView
            models={installedModels}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            options={serverOptions}
            setOptions={setServerOptions}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-blue-500/30">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0 bg-background/50">
          <main className="flex-1 overflow-hidden p-6">
            <div className="max-w-5xl mx-auto w-full h-full">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
      <StatusBar serverStatus={serverStatus} version={ConfigService.getAppVersion()} />
    </div>
  );
}

export default App;
