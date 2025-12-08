import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { FlmService } from "../services/flm";
import { NotificationService } from "../services/notification";
import type { ServerStatus, ServerOptions, FlmModel } from "../types";
import { DEFAULT_SERVER_OPTIONS, DEFAULT_PRESETS_CONFIG } from "../types";
import { isPresetId, findPresetById } from "../lib/presets";

interface UseServerManagerProps {
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    installedModels: FlmModel[];
    initialServerOptions: ServerOptions;
    isConfigLoaded: boolean;
    onNavigateToLogs?: () => void;
}

interface UseServerManagerReturn {
    serverStatus: ServerStatus;
    logs: string[];
    serverOptions: ServerOptions;
    setServerOptions: (options: ServerOptions | ((prev: ServerOptions) => ServerOptions)) => void;
    handleToggleServer: (options?: ServerOptions) => Promise<void>;
    addLog: (log: string) => void;
    clearLogs: () => void;
}

export function useServerManager({
    selectedModel,
    setSelectedModel,
    installedModels,
    initialServerOptions,
    isConfigLoaded,
    onNavigateToLogs,
}: UseServerManagerProps): UseServerManagerReturn {
    const { t } = useTranslation();
    const [serverStatus, setServerStatus] = useState<ServerStatus>("stopped");
    const [logs, setLogs] = useState<string[]>([]);
    const [serverOptions, setServerOptions] = useState<ServerOptions>({
        ...DEFAULT_SERVER_OPTIONS,
        ...initialServerOptions,
    });
    const [pendingRestart, setPendingRestart] = useState<ServerOptions | null>(null);

    // Refs pour les closures dans les event listeners
    const serverStatusRef = useRef(serverStatus);
    const selectedModelRef = useRef(selectedModel);
    const serverOptionsRef = useRef(serverOptions);
    const installedModelsRef = useRef(installedModels);

    useEffect(() => {
        serverStatusRef.current = serverStatus;
    }, [serverStatus]);

    useEffect(() => {
        selectedModelRef.current = selectedModel;
    }, [selectedModel]);

    useEffect(() => {
        serverOptionsRef.current = serverOptions;
    }, [serverOptions]);

    useEffect(() => {
        installedModelsRef.current = installedModels;
    }, [installedModels]);

    // Update options when config is loaded
    useEffect(() => {
        if (isConfigLoaded) {
            setServerOptions((prev) => ({
                ...prev,
                ...initialServerOptions,
            }));
        }
    }, [isConfigLoaded, initialServerOptions]);

    // Set default context length from model if not specified
    useEffect(() => {
        if (isConfigLoaded && installedModels.length > 0 && selectedModel) {
            setServerOptions((prev) => {
                // If context length is 0 (default/unset), try to get it from the model
                if (!prev.ctxLen) {
                    const model = installedModels.find((m) => m.name === selectedModel);
                    if (model?.contextLength) {
                        return { ...prev, ctxLen: model.contextLength };
                    }
                }
                return prev;
            });
        }
    }, [isConfigLoaded, installedModels, selectedModel]);

    const addLog = useCallback((log: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const handleToggleServer = useCallback(
        async (options?: ServerOptions) => {
            if (serverStatusRef.current === "running") {
                try {
                    await FlmService.stopServer(addLog);
                } catch (error) {
                    addLog(t("app.log_stop_error", { error }));
                }
            } else {
                setServerStatus("starting");
                setLogs([]);

                // Get actual model name (extract from preset if needed)
                let actualModel = selectedModelRef.current;
                if (isPresetId(actualModel)) {
                    const preset = findPresetById(actualModel, DEFAULT_PRESETS_CONFIG);
                    actualModel = preset?.model || "";
                }

                addLog(t("app.log_starting_server", { model: actualModel || "None" }));

                // Notify server starting (only if window not visible)
                NotificationService.send(
                    t("app.notification_server_starting_title"),
                    t("app.notification_server_starting_body", { model: actualModel || "None" })
                );

                try {
                    const optionsToUse = options || serverOptionsRef.current;

                    await FlmService.startServer(
                        actualModel,
                        optionsToUse,
                        (log) => {
                            addLog(log);
                            if (log.includes("Enter 'exit' to stop the server:")) {
                                setServerStatus("running");
                                NotificationService.send(
                                    t("app.notification_server_started_title"),
                                    t("app.notification_server_started_body", {
                                        model: actualModel || "None",
                                    })
                                );
                            }
                            if (log.includes("[SYSTEM] Server stopped with code")) {
                                setServerStatus("stopped");
                                if (!log.includes("code 0")) {
                                    NotificationService.send(
                                        t("app.notification_server_error_title"),
                                        t("app.notification_server_error_body")
                                    );
                                } else {
                                    NotificationService.send(
                                        t("app.notification_server_stopped_title"),
                                        t("app.notification_server_stopped_body")
                                    );
                                }
                            }
                        }
                    );
                } catch (error) {
                    setServerStatus("stopped");
                    addLog(t("app.log_start_error", { error }));
                }
            }
        },
        [addLog, t]
    );

    // Handle pending restart after server stops
    useEffect(() => {
        if (serverStatus === "stopped" && pendingRestart) {
            const optionsToUse = pendingRestart;
            setPendingRestart(null);
            setTimeout(() => {
                handleToggleServer(optionsToUse);
            }, 300);
        }
    }, [serverStatus, pendingRestart, handleToggleServer]);

    // Event listeners
    useEffect(() => {
        const unlistenStart = listen("request-start-server", () => {
            if (serverStatusRef.current === "stopped") {
                handleToggleServer();
            }
        });

        const unlistenStop = listen("request-stop-server", () => {
            if (serverStatusRef.current === "running") {
                handleToggleServer();
            }
        });

        const unlistenSelectModel = listen<string>("select-model", async (event) => {
            const newSelection = event.payload;

            if (newSelection === selectedModelRef.current) return;

            let newOptions: ServerOptions;

            if (isPresetId(newSelection)) {
                // It's a preset - apply preset options
                const preset = findPresetById(newSelection, DEFAULT_PRESETS_CONFIG);
                if (preset) {
                    newOptions = { ...serverOptionsRef.current, ...preset.options };
                } else {
                    newOptions = { ...serverOptionsRef.current, ctxLen: 0 };
                }
            } else {
                // It's a regular model - reset features to defaults
                const model = installedModelsRef.current.find((m) => m.name === newSelection);
                const newCtxLen = model?.contextLength || 0;
                newOptions = {
                    ...serverOptionsRef.current,
                    ctxLen: newCtxLen,
                    asr: false,
                    embed: false,
                };
            }

            setSelectedModel(newSelection);
            setServerOptions(newOptions);

            if (serverStatusRef.current === "running") {
                setPendingRestart(newOptions);
                await FlmService.stopServer((log) => addLog(log));
            }
        });

        const unlistenViewLogs = listen("view-logs", () => {
            onNavigateToLogs?.();
        });

        const unlistenToggleAsr = listen("toggle-asr", async () => {
            const newOptions = { ...serverOptionsRef.current, asr: !serverOptionsRef.current.asr };
            setServerOptions(newOptions);

            if (serverStatusRef.current === "running") {
                setPendingRestart(newOptions);
                await FlmService.stopServer((log) => addLog(log));
            }
        });

        const unlistenToggleEmbed = listen("toggle-embed", async () => {
            const newOptions = { ...serverOptionsRef.current, embed: !serverOptionsRef.current.embed };
            setServerOptions(newOptions);

            if (serverStatusRef.current === "running") {
                setPendingRestart(newOptions);
                await FlmService.stopServer((log) => addLog(log));
            }
        });

        return () => {
            unlistenStart.then((f) => f());
            unlistenStop.then((f) => f());
            unlistenSelectModel.then((f) => f());
            unlistenViewLogs.then((f) => f());
            unlistenToggleAsr.then((f) => f());
            unlistenToggleEmbed.then((f) => f());
        };
    }, [handleToggleServer, setSelectedModel, addLog, onNavigateToLogs]);

    return {
        serverStatus,
        logs,
        serverOptions,
        setServerOptions,
        handleToggleServer,
        addLog,
        clearLogs,
    };
}
