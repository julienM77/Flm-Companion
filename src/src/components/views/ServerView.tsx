import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Square, Activity, Cpu, MemoryStick, Sliders, Cog, FileText, Save, Settings2, Bookmark, ChevronDown, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useTranslation } from "react-i18next";
import { LogsViewer } from "../shared/LogsViewer";
import { InfoTooltip } from "../shared/InfoTooltip";
import { ResourceMonitor } from "../shared/ResourceMonitor";
import { SavePresetDialog, ManagePresetsDialog } from "../dialogs";
import { getAllPresets, isPresetId, findPresetById, getPresetDisplayName } from "../../lib/presets";
import { ServerPreset } from "../../types";
import { useAppContext } from "../../contexts";
import { SystemService } from "../../services/system";

const CONTEXT_LENGTHS = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
const PREFILL_LENGTHS = [512, 1024, 2048, 4096, 8192, 16384, 32768];
const API_PROXY_PORT = 52626;

interface ApiMetrics {
    requests: number;
    ttftMs: number | null;
    promptTokens: number | null;
}

function formatTokenCount(value: number): string {
    return value >= 1024 ? `${value / 1024}k` : `${value}`;
}
import type { FlmModel, ServerOptions, ServerStatus, PerformanceMode } from "../../types";
import { toast } from "sonner";

interface ServerViewProps {
    serverStatus: ServerStatus;
    onToggleServer: (options: ServerOptions) => void;
    models: FlmModel[];
    selectedModel: string;
    onSelectModel: (model: string) => void;
    logs: string[];
    onClearLogs: () => void;
    options: ServerOptions;
    setOptions: (options: ServerOptions | ((prev: ServerOptions) => ServerOptions)) => void;
}

export const ServerView = ({
    serverStatus,
    onToggleServer,
    models,
    selectedModel,
    onSelectModel,
    logs,
    onClearLogs,
    options,
    setOptions,
}: ServerViewProps) => {
    const { t } = useTranslation();
    const { presetsConfig, saveUserPreset, reloadPresets } = useAppContext();
    const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
    const [managePresetsDialogOpen, setManagePresetsDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [liveRam, setLiveRam] = useState({ used: 0, total: 0, percentage: 0, flmProcess: 0 });

    useEffect(() => {
        if (serverStatus === "running" || serverStatus === "starting") return;
        let active = true;
        const refreshRam = async () => {
            const stats = await SystemService.getSystemStats();
            if (active) setLiveRam(stats.memory);
        };
        refreshRam();
        const interval = window.setInterval(refreshRam, 2000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [serverStatus]);

    const handleSavePreset = async (name: string) => {
        try {
            // Generate a unique ID from the name
            const presetId = `preset:user-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            const newPreset: ServerPreset = {
                id: presetId,
                name,
                model: selectedModel,
                options: { ...options },
            };

            await saveUserPreset(newPreset);

            toast.success(t('server.preset_saved') || 'Preset saved successfully!', {
                description: name,
            });
        } catch (error) {
            console.error('Failed to save preset:', error);
            toast.error(t('server.preset_save_error') || 'Failed to save preset');
        }
    };

    const handleOptionChange = (key: keyof ServerOptions, value: ServerOptions[keyof ServerOptions]) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const selectedModelInfo = models.find(model => model.name === selectedModel);
    const maxContextLength = selectedModelInfo?.maxContextLength || selectedModelInfo?.contextLength || 32768;
    const contextChoices = CONTEXT_LENGTHS.filter(length => length <= maxContextLength);
    const prefillChoices = PREFILL_LENGTHS.filter(length => length <= maxContextLength);
    const contextValue = contextChoices.includes(options.ctxLen || 0)
        ? options.ctxLen!
        : selectedModelInfo?.contextLength || contextChoices[contextChoices.length - 1];
    const defaultPrefillLength = selectedModelInfo?.maxPrefillLength || 4096;
    const modelLoadBytes = selectedModelInfo?.realSize || 0;
    const defaultContext = selectedModelInfo?.contextLength || 32768;
    const contextReserveBytes = modelLoadBytes
        ? 256 * 1024 * 1024 * Math.max(1, contextValue / defaultContext)
        : 0;
    const runtimeReserveBytes = modelLoadBytes ? 512 * 1024 * 1024 : 0;
    const estimatedRamBytes = modelLoadBytes + contextReserveBytes + runtimeReserveBytes;
    const formatGb = (bytes: number) => `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    const [copiedApi, setCopiedApi] = useState<string | null>(null);
    const [apiMetrics, setApiMetrics] = useState<ApiMetrics>({ requests: 0, ttftMs: null, promptTokens: null });
    const apiBaseUrl = `http://127.0.0.1:${API_PROXY_PORT}/v1`;
    const apiModel = isPresetId(selectedModel)
        ? findPresetById(selectedModel, presetsConfig)?.model || selectedModel
        : selectedModel;
    const apiSnippets = {
        baseUrl: apiBaseUrl,
        curl: `curl ${apiBaseUrl}/chat/completions -H "Content-Type: application/json" -d '{"model":"${apiModel}","messages":[{"role":"user","content":"Hello"}]}'`,
        python: `import requests\n\nrequests.post("${apiBaseUrl}/chat/completions", json={"model": "${apiModel}", "messages": [{"role": "user", "content": "Hello"}]})`,
    };

    const copyApiSnippet = async (kind: keyof typeof apiSnippets) => {
        await navigator.clipboard.writeText(apiSnippets[kind]);
        setCopiedApi(kind);
        window.setTimeout(() => setCopiedApi(null), 1500);
    };

    useEffect(() => {
        let active = true;
        const refreshMetrics = async () => {
            try {
                const metrics = await invoke<ApiMetrics>("get_api_metrics");
                if (active) setApiMetrics(metrics);
            } catch { }
        };
        refreshMetrics();
        const interval = window.setInterval(refreshMetrics, 1000);
        return () => { active = false; window.clearInterval(interval); };
    }, []);

    return (
        <div className="h-full flex flex-col space-y-4 lg:space-y-6 overflow-y-auto lg:overflow-hidden">
            <div className="flex justify-between items-center sticky top-0 bg-background z-10 pb-4 -mb-2 lg:static lg:pb-2 lg:mb-0">
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('server.title')}</h2>
                    <p className="text-muted-foreground text-sm">{t('server.subtitle')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2" title={t("server.api_description")}>
                                {copiedApi ? <Check size={15} /> : <Copy size={15} />}
                                {t("server.developer_api")}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                            <DropdownMenuLabel className="space-y-1">
                                <div>{t("server.developer_api")}</div>
                                <div className="font-mono text-xs font-normal text-muted-foreground break-all">{apiBaseUrl}</div>
                                <div className="text-xs font-normal text-emerald-400">{t("server.active_model_only")}</div>
                                {serverStatus === "stopped" && <div className="text-xs font-normal text-yellow-400">{t("server.api_start_required")}</div>}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => copyApiSnippet("baseUrl")}>
                                {copiedApi === "baseUrl" ? <Check size={15} className="mr-2" /> : <Copy size={15} className="mr-2" />}
                                {t("server.copy_base_url")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyApiSnippet("curl")}>
                                {copiedApi === "curl" ? <Check size={15} className="mr-2" /> : <Copy size={15} className="mr-2" />}
                                {t("server.copy_curl")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyApiSnippet("python")}>
                                {copiedApi === "python" ? <Check size={15} className="mr-2" /> : <Copy size={15} className="mr-2" />}
                                {t("server.copy_python")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {serverStatus === "stopped" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <Bookmark size={16} />
                                    {t('server.presets')}
                                    <ChevronDown size={14} className="ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setManagePresetsDialogOpen(true)}>
                                    <Settings2 size={16} className="mr-2" />
                                    {t('server.manage_presets')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSavePresetDialogOpen(true)}
                                    disabled={false}
                                >
                                    <Save size={16} className="mr-2" />
                                    {t('server.save_preset')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {serverStatus === "stopped" ? (
                        <Button
                            onClick={() => onToggleServer(options)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                        >
                            <Play size={16} /> {t('server.start_server')}
                        </Button>
                    ) : serverStatus === "starting" ? (
                        <Button
                            disabled
                            size="sm"
                            className="bg-yellow-600/50 text-white flex items-center gap-2 cursor-wait"
                        >
                            <Activity size={16} className="animate-spin" /> {t('server.starting')}
                        </Button>
                    ) : (
                        <Button
                            variant="destructive"
                            onClick={() => onToggleServer(options)}
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                        >
                            <Square size={16} /> {t('server.stop_server')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 m-2 lg:gap-6 lg:flex-1 lg:min-h-0">
                {/* Configuration Panel or Resource Monitor */}
                <div className="lg:col-span-2 space-y-4 lg:space-y-6 lg:overflow-y-auto lg:pr-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                <MemoryStick size={14} />
                                {t('server.free_ram')}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                                <span className="font-mono text-sm text-foreground">{liveRam.total ? `${((liveRam.total - liveRam.used) / 1024).toFixed(1)} GB` : "—"}</span>
                                <span className="text-xs text-muted-foreground">{liveRam.total ? `${liveRam.percentage.toFixed(1)}% used` : "—"}</span>
                            </div>
                            <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, liveRam.percentage)}%` }} />
                            </div>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                <Cpu size={14} />
                                {t('server.flm_process_ram')}
                            </div>
                            <div className="mt-1 font-mono text-sm text-foreground">{liveRam.flmProcess ? `${liveRam.flmProcess.toFixed(1)} MB` : "—"}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {t('server.launch_context')}
                                <InfoTooltip text={t('server.launch_context_desc')} />
                            </div>
                            <div className="mt-1 font-mono text-sm text-foreground">{formatTokenCount(contextValue)}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{t('server.max_supported')}: {formatTokenCount(maxContextLength)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('server.api_metrics')}</div>
                            <div className="mt-1 flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">TTFT <span className="font-mono text-foreground">{apiMetrics.ttftMs ? `${apiMetrics.ttftMs} ms` : "—"}</span></span>
                                <span className="text-muted-foreground">CTX <span className="font-mono text-foreground">{apiMetrics.promptTokens ? `${formatTokenCount(apiMetrics.promptTokens)} / ${formatTokenCount(maxContextLength)}` : "—"}</span></span>
                            </div>
                        </div>
                    </div>
                    {serverStatus === "running" || serverStatus === "starting" ? (
                        /* Show Resource Monitor when server is running or starting */
                        <ResourceMonitor refreshInterval={2000} onStats={(stats) => setLiveRam(stats.memory)} />
                    ) : (
                        /* Show Configuration when server is stopped */
                        <>
                            {/* Model Selection */}
                            <Card className="bg-card border-border shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                        <Cpu size={16} className="text-muted-foreground" />
                                        {t('server.model')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Select
                                            value={selectedModel}
                                            onValueChange={(val) => {
                                                if (isPresetId(val)) {
                                                    // Apply preset configuration
                                                    const preset = findPresetById(val, presetsConfig);
                                                    if (preset) {
                                                        onSelectModel(val);
                                                        setOptions(prev => ({
                                                            ...prev,
                                                            ...preset.options,
                                                        }));
                                                    }
                                                } else {
                                                    // Regular model selection - reset features to defaults
                                                    onSelectModel(val);
                                                    const model = models.find(m => m.name === val);
                                                    setOptions(prev => ({
                                                        ...prev,
                                                        ctxLen: model?.contextLength || 0,
                                                        asr: false,
                                                        embed: false,
                                                    }));
                                                }
                                            }}
                                            disabled={serverStatus !== "stopped"}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('server.select_model_placeholder')}>
                                                    {(() => {
                                                        if (isPresetId(selectedModel)) {
                                                            const preset = findPresetById(selectedModel, presetsConfig);
                                                            return preset ? getPresetDisplayName(preset, t) : selectedModel;
                                                        }
                                                        return selectedModel || t('server.select_model_placeholder');
                                                    })()}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Presets Group */}
                                                <SelectGroup>
                                                    <SelectLabel>{t('tray.presets_group')}</SelectLabel>
                                                    {getAllPresets(presetsConfig).map(preset => (
                                                        <SelectItem key={preset.id} value={preset.id}>
                                                            {getPresetDisplayName(preset, t)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                                {/* Models Group */}
                                                <SelectGroup>
                                                    <SelectLabel>{t('tray.models_group')}</SelectLabel>
                                                    {models.length === 0 ? (
                                                        <SelectItem value="none" disabled>{t('server.no_model_installed')}</SelectItem>
                                                    ) : (
                                                        models.map(m => (
                                                            <SelectItem key={m.name} value={m.name}>
                                                                {m.name} ({m.size})
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="border-t border-border pt-2 text-xs leading-4">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                {t('server.estimated_ram')}
                                                <InfoTooltip text={t('server.load_estimate_desc')} />
                                            </span>
                                            <span className="font-mono text-foreground">{estimatedRamBytes ? formatGb(estimatedRamBytes) : "—"}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground" title={t('server.load_estimate_desc')}>
                                            {modelLoadBytes ? <>
                                                <div className="flex items-center gap-2">
                                                    <span>model {formatGb(modelLoadBytes)}</span>
                                                    <span>ctx {formatGb(contextReserveBytes)}</span>
                                                    <span>runtime {formatGb(runtimeReserveBytes)}</span>
                                                </div>
                                            </> : "—"}
                                            {liveRam.flmProcess > 0 && <span className="shrink-0 text-emerald-400">observed {formatGb(liveRam.flmProcess * 1024 * 1024)}</span>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start gap-2">
                                        <Sliders size={16} />
                                        {t('server.advanced_settings')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[min(92vw,960px)] max-w-4xl max-h-[85vh] overflow-visible flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>{t('server.advanced_settings')}</DialogTitle>
                                        <DialogDescription>{t('server.advanced_settings_desc')}</DialogDescription>
                                    </DialogHeader>

                                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">

                            {/* Features Accordion */}
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="features" className="border-none">
                                    <Card className="bg-card border-border shadow-sm">
                                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                                <Cog size={16} className="text-muted-foreground" />
                                                {t('server.features')}
                                            </CardTitle>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <CardContent className="space-y-4 pt-0">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-foreground">{t('server.enable_asr')}</span>
                                                        <InfoTooltip text={t('server.asr_desc')} />
                                                    </div>
                                                    <Switch
                                                        checked={options.asr}
                                                        onCheckedChange={(checked) => handleOptionChange('asr', checked)}
                                                        disabled={serverStatus !== "stopped"}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-foreground">{t('server.enable_embeddings')}</span>
                                                        <InfoTooltip text={t('server.embeddings_desc')} />
                                                    </div>
                                                    <Switch
                                                        checked={options.embed}
                                                        onCheckedChange={(checked) => handleOptionChange('embed', checked)}
                                                        disabled={serverStatus !== "stopped"}
                                                    />
                                                </div>
                                            </CardContent>
                                        </AccordionContent>
                                    </Card>
                                </AccordionItem>
                            </Accordion>

                            {/* Advanced Settings Accordion */}
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="advanced" className="border-none">
                                    <Card className="bg-card border-border shadow-sm">
                                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                                <Sliders size={16} className="text-muted-foreground" />
                                                {t('server.advanced_settings')}
                                            </CardTitle>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <CardContent className="space-y-4 pt-0">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <label className="block text-xs font-medium text-muted-foreground">{t('server.power_mode')}</label>
                                                        <InfoTooltip text={t('server.power_mode_desc')} />
                                                    </div>
                                                    <Select
                                                        value={options.pmode}
                                                        onValueChange={(value) => handleOptionChange('pmode', value as PerformanceMode)}
                                                        disabled={serverStatus !== "stopped"}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('server.power_mode')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="powersaver">{t('chat.power_modes.powersaver')}</SelectItem>
                                                            <SelectItem value="balanced">{t('chat.power_modes.balanced')}</SelectItem>
                                                            <SelectItem value="performance">{t('chat.power_modes.performance')}</SelectItem>
                                                            <SelectItem value="turbo">{t('chat.power_modes.turbo')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.host')}</label>
                                                            <InfoTooltip text={t('server.host_desc')} />
                                                        </div>
                                                        <Input
                                                            type="text"
                                                            value={options.host || "127.0.0.1"}
                                                            onChange={(e) => handleOptionChange('host', e.target.value)}
                                                            disabled={serverStatus !== "stopped"}
                                                            className="bg-input border-input text-foreground h-9"
                                                            placeholder="127.0.0.1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.port')}</label>
                                                            <InfoTooltip text={t('server.port_desc')} />
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            value={options.port}
                                                            onChange={(e) => handleOptionChange('port', parseInt(e.target.value))}
                                                            disabled={serverStatus !== "stopped"}
                                                            className="bg-input border-input text-foreground h-9"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.socket_conn')}</label>
                                                            <InfoTooltip text={t('server.socket_conn_desc')} />
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            value={options.socket}
                                                            onChange={(e) => handleOptionChange('socket', parseInt(e.target.value))}
                                                            disabled={serverStatus !== "stopped"}
                                                            className="bg-input border-input text-foreground h-9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.queue_len')}</label>
                                                            <InfoTooltip text={t('server.queue_len_desc')} />
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            value={options.qLen}
                                                            onChange={(e) => handleOptionChange('qLen', parseInt(e.target.value))}
                                                            disabled={serverStatus !== "stopped"}
                                                            className="bg-input border-input text-foreground h-9"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <label className="block text-xs font-medium text-muted-foreground">{t('server.context_tokens')}</label>
                                                        <InfoTooltip text={t('server.context_tokens_desc')} />
                                                    </div>
                                                    <Select
                                                        value={String(contextValue)}
                                                        onValueChange={(value) => handleOptionChange('ctxLen', Number(value))}
                                                        disabled={serverStatus !== "stopped"}
                                                    >
                                                        <SelectTrigger className="bg-input border-input text-foreground h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {contextChoices.map(length => (
                                                                <SelectItem key={length} value={String(length)}>
                                                                    {formatTokenCount(length)} tokens
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.backend')}</label>
                                                            <InfoTooltip text={t('server.backend_desc')} />
                                                        </div>
                                                        <Select
                                                            value={options.backend || "auto"}
                                                            onValueChange={(value) => handleOptionChange('backend', value === "auto" ? "" : value)}
                                                            disabled={serverStatus !== "stopped"}
                                                        >
                                                            <SelectTrigger className="bg-input border-input text-foreground h-9"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="auto">{t('server.backend_auto')}</SelectItem>
                                                                <SelectItem value="flm">flm</SelectItem>
                                                                <SelectItem value="core">core</SelectItem>
                                                                <SelectItem value="flm_npu">flm_npu</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.decision_model')}</label>
                                                            <InfoTooltip text={t('server.decision_model_desc')} />
                                                        </div>
                                                        <Select
                                                            value={options.decision || "none"}
                                                            onValueChange={(value) => handleOptionChange('decision', value === "none" ? "" : value)}
                                                            disabled={serverStatus !== "stopped"}
                                                        >
                                                            <SelectTrigger className="bg-input border-input text-foreground h-9"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">{t('server.disabled')}</SelectItem>
                                                                {['d3:lite', 'd3:nano', 'd3:mini', 'd3:turbo', 'd3:ultra'].map(value => (
                                                                    <SelectItem key={value} value={value}>{value}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <label className="block text-xs font-medium text-muted-foreground">{t('server.prefill_chunk')}</label>
                                                        <InfoTooltip text={t('server.prefill_chunk_desc')} />
                                                    </div>
                                                    <Select
                                                        value={String(options.prefillChunkLen || defaultPrefillLength)}
                                                        onValueChange={(value) => handleOptionChange('prefillChunkLen', Number(value))}
                                                        disabled={serverStatus !== "stopped"}
                                                    >
                                                        <SelectTrigger className="bg-input border-input text-foreground h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {prefillChoices.map(length => (
                                                                <SelectItem key={length} value={String(length)}>{formatTokenCount(length)} tokens</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.prefix_cache_mb')}</label>
                                                            <InfoTooltip text={t('server.prefix_cache_mb_desc')} />
                                                        </div>
                                                        <Input type="number" min="0" value={options.prefixCacheMb ?? ""} onChange={(e) => handleOptionChange('prefixCacheMb', parseInt(e.target.value) || 0)} disabled={serverStatus !== "stopped"} className="bg-input border-input text-foreground h-9" placeholder="4096" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.prefix_slots')}</label>
                                                            <InfoTooltip text={t('server.prefix_slots_desc')} />
                                                        </div>
                                                        <Input type="number" min="0" max="32" value={options.prefixSlots ?? ""} onChange={(e) => handleOptionChange('prefixSlots', parseInt(e.target.value) || 0)} disabled={serverStatus !== "stopped"} className="bg-input border-input text-foreground h-9" placeholder="8" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.prefix_min_gain')}</label>
                                                            <InfoTooltip text={t('server.prefix_min_gain_desc')} />
                                                        </div>
                                                        <Input type="number" min="0" value={options.prefixMinGain ?? ""} onChange={(e) => handleOptionChange('prefixMinGain', parseInt(e.target.value) || 0)} disabled={serverStatus !== "stopped"} className="bg-input border-input text-foreground h-9" placeholder="128" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <label className="block text-xs font-medium text-muted-foreground">{t('server.image_resize')}</label>
                                                            <InfoTooltip text={t('server.image_resize_desc')} />
                                                        </div>
                                                        <Select value={String(options.imgPreResize ?? 2)} onValueChange={(value) => handleOptionChange('imgPreResize', Number(value))} disabled={serverStatus !== "stopped"}>
                                                            <SelectTrigger className="bg-input border-input text-foreground h-9"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(value => <SelectItem key={value} value={String(value)}>{value === 0 ? t('server.original') : `${[0, 480, 720, 1080, 1440, 2160, 2880, 3240, 4320][value]}p`}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 pt-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-foreground">{t('server.enable_cors')}</span>
                                                            <InfoTooltip text={t('server.enable_cors_desc')} />
                                                        </div>
                                                        <Switch
                                                            checked={options.cors}
                                                            onCheckedChange={(checked) => handleOptionChange('cors', checked)}
                                                            disabled={serverStatus !== "stopped"}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-foreground">{t('server.enable_preemption')}</span>
                                                            <InfoTooltip text={t('server.enable_preemption_desc')} />
                                                        </div>
                                                        <Switch
                                                            checked={options.preemption}
                                                            onCheckedChange={(checked) => handleOptionChange('preemption', checked)}
                                                            disabled={serverStatus !== "stopped"}
                                                        />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </AccordionContent>
                                    </Card>
                                </AccordionItem>
                            </Accordion>

                                    </div>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>

                {/* Logs Panel - Accordion on mobile, normal on desktop */}
                <div className="lg:col-span-3 lg:h-full lg:min-h-0">
                    {/* Mobile: Accordion */}
                    <div className="lg:hidden">
                        <Accordion type="single" collapsible defaultValue="logs" className="w-full">
                            <AccordionItem value="logs" className="border-none">
                                <Card className="bg-card border-border shadow-sm">
                                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <FileText size={16} className="text-muted-foreground" />
                                            {t('server.logs_title')}
                                        </CardTitle>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-6 pb-4">
                                            <LogsViewer
                                                logs={logs}
                                                variant="content"
                                                className="h-80 overflow-y-auto"
                                                onClear={onClearLogs}
                                                emptyMessage={serverStatus === "stopped" ? t('server.waiting_logs') : t('server.no_logs')}
                                            />
                                        </div>
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                        </Accordion>
                    </div>
                    {/* Desktop: Normal display */}
                    <div className="hidden lg:flex lg:h-full">
                        <LogsViewer
                            logs={logs}
                            className="h-full w-full"
                            onClear={onClearLogs}
                            emptyMessage={serverStatus === "stopped" ? t('server.waiting_logs') : t('server.no_logs')}
                        />
                    </div>
                </div>
            </div>

            <SavePresetDialog
                open={savePresetDialogOpen}
                onOpenChange={setSavePresetDialogOpen}
                selectedModel={selectedModel}
                options={options}
                onSave={handleSavePreset}
            />

            <ManagePresetsDialog
                open={managePresetsDialogOpen}
                onOpenChange={setManagePresetsDialogOpen}
                onPresetDeleted={() => reloadPresets()}
            />
        </div>
    );
};
