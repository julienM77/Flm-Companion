import "./App.css";
import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { StatusBar } from "./components/layout/StatusBar";
import { ChatView } from "./components/views/ChatView";
import { ModelsView } from "./components/views/ModelsView";
import { ServerView } from "./components/views/ServerView";
import { SettingsView } from "./components/views/SettingsView";
import { AboutView } from "./components/views/AboutView";
import { ConfigService } from "./services/config";
import { AppProvider, useAppContext } from "./contexts";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "sonner";
import { FlmInstallDialog } from "./components/dialogs/FlmInstallDialog";
import { UpdateAvailableDialog } from "./components/dialogs/UpdateAvailableDialog";

// Wrappers
function ChatViewWrapper() {
  const { runnableModels, selectedModel, setSelectedModel, serverOptions, setServerOptions } = useAppContext();
  return (
    <ChatView
      models={runnableModels}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      options={serverOptions}
      setOptions={setServerOptions}
    />
  );
}

function ServerViewWrapper() {
  const {
    serverStatus,
    handleToggleServer,
    runnableModels,
    selectedModel,
    setSelectedModel,
    logs,
    clearLogs,
    serverOptions,
    setServerOptions,
  } = useAppContext();
  return (
    <ServerView
      serverStatus={serverStatus}
      onToggleServer={handleToggleServer}
      models={runnableModels}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      logs={logs}
      onClearLogs={clearLogs}
      options={serverOptions}
      setOptions={setServerOptions}
    />
  );
}

function ModelsWrapper() {
  const { installedModels, loadInstalledModels, hardwareInfo } = useAppContext();
  return (
    <ModelsView
      installedModels={installedModels}
      onRefresh={() => loadInstalledModels(true)}
      hardwareInfo={hardwareInfo}
    />
  );
}

function SettingsWrapper() {
  const { theme, setTheme, startMinimized, setStartMinimized } = useAppContext();
  return (
    <SettingsView
      theme={theme}
      setTheme={setTheme}
      startMinimized={startMinimized}
      setStartMinimized={setStartMinimized}
    />
  );
}

function AboutWrapper() {
  const { hardwareInfo, loadHardwareInfo } = useAppContext();
  return (
    <AboutView
      hardwareInfo={hardwareInfo}
      onRefreshHardware={() => loadHardwareInfo(true)}
    />
  );
}

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  chat: ChatViewWrapper,
  server: ServerViewWrapper,
  models: ModelsWrapper,
  settings: SettingsWrapper,
  about: AboutWrapper,
};

function AppContent() {
  const { activeTab, setActiveTab, serverStatus, selectedModel, startupChecks, isCheckingStartup, reloadStartupChecks } = useAppContext();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const renderContent = () => {
    const Component = TAB_COMPONENTS[activeTab] || ChatViewWrapper;
    return <Component />;
  };

  // Show FLM install dialog if FLM is not installed (non-closable)
  const showFlmInstallDialog = !isCheckingStartup && startupChecks && !startupChecks.flmInstalled;

  // Show update dialog if there are updates available (closable)
  const hasUpdates = startupChecks && (startupChecks.companionUpdateAvailable || startupChecks.flmUpdateAvailable);

  // Auto-show update dialog once when updates are detected
  useEffect(() => {
    if (hasUpdates && !showFlmInstallDialog) {
      setShowUpdateDialog(true);
    }
  }, [hasUpdates, showFlmInstallDialog]);

  return (
    <>
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
        <StatusBar serverStatus={serverStatus} selectedModel={selectedModel} version={ConfigService.getAppVersion()} />
      </div>

      {/* Startup Dialogs */}
      <FlmInstallDialog
        open={showFlmInstallDialog || false}
        flmRelease={startupChecks?.flmLatestRelease || null}
        onInstallComplete={reloadStartupChecks}
      />

      {hasUpdates && (
        <UpdateAvailableDialog
          open={showUpdateDialog}
          onOpenChange={setShowUpdateDialog}
          onInstallComplete={reloadStartupChecks}
          companionUpdate={startupChecks?.companionUpdateAvailable ? {
            available: true,
            release: startupChecks.companionLatestRelease,
            currentVersion: startupChecks.companionVersion
          } : null}
          flmUpdate={startupChecks?.flmUpdateAvailable ? {
            available: true,
            release: startupChecks.flmLatestRelease,
            currentVersion: startupChecks.flmVersion
          } : null}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={200}>
        <Toaster
          position="bottom-right"
          expand={false}
          richColors
          closeButton
        />
        <AppContent />
      </TooltipProvider>
    </AppProvider>
  );
}

export default App;
