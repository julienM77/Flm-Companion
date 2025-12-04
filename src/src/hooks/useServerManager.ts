import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
    sendNotification,
    isPermissionGranted,
    requestPermission,
} from "@tauri-apps/plugin-notification";
import { useTranslation } from "react-i18next";
import { FlmService } from "../services/flm";
import type { ServerStatus, ServerOptions, FlmModel } from "../types";
import { DEFAULT_SERVER_OPTIONS } from "../types";

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

    // Request notification permission
    useEffect(() => {
        if (!isConfigLoaded) return;

        (async () => {
            const permissionGranted = await isPermissionGranted();
            if (!permissionGranted) {
                await requestPermission();
            }
        })();
    }, [isConfigLoaded]);

    const addLog = useCallback((log: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
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
                addLog(t("app.log_starting_server", { model: selectedModelRef.current || "None" }));

                try {
                    const optionsToUse = options || serverOptionsRef.current;

                    await FlmService.startServer(
                        selectedModelRef.current,
                        optionsToUse,
                        (log) => {
                            addLog(log);
                            if (log.includes("Enter 'exit' to stop the server:")) {
                                setServerStatus("running");
                                sendNotification({
                                    title: t("app.notification_server_started_title"),
                                    body: t("app.notification_server_started_body", {
                                        model: selectedModelRef.current || "None",
                                    }),
                                });
                            }
                            if (log.includes("[SYSTEM] Server stopped with code")) {
                                setServerStatus("stopped");
                                if (!log.includes("code 0")) {
                                    sendNotification({
                                        title: t("app.notification_server_error_title"),
                                        body: t("app.notification_server_error_body"),
                                    });
                                } else {
                                    sendNotification({
                                        title: t("app.notification_server_stopped_title"),
                                        body: t("app.notification_server_stopped_body"),
                                    });
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
            const newModelName = event.payload;
            if (newModelName === selectedModelRef.current) return;

            const model = installedModelsRef.current.find((m) => m.name === newModelName);
            const newCtxLen = model?.contextLength || 0;
            const newOptions = { ...serverOptionsRef.current, ctxLen: newCtxLen };

            setSelectedModel(newModelName);
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
    };
}
