import { Play, Square, Activity, Cpu, Sliders, Cog, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { useTranslation } from "react-i18next";
import { LogsViewer } from "../shared/LogsViewer";
import { InfoTooltip } from "../shared/InfoTooltip";
import { getAllPresets, isPresetId, findPresetById, getPresetDisplayName } from "../../lib/presets";
import { DEFAULT_PRESETS_CONFIG } from "../../types";
import type { FlmModel, ServerOptions, ServerStatus, PerformanceMode } from "../../types";

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
    setOptions
}: ServerViewProps) => {
    const { t } = useTranslation();

    const handleOptionChange = (key: keyof ServerOptions, value: ServerOptions[keyof ServerOptions]) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="h-full flex flex-col space-y-4 lg:space-y-6 overflow-y-auto lg:overflow-hidden">
            <div className="flex justify-between items-center sticky top-0 bg-background z-10 pb-4 -mb-2 lg:static lg:pb-2 lg:mb-0">
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('server.title')}</h2>
                    <p className="text-muted-foreground text-sm">{t('server.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 m-2 lg:gap-6 lg:flex-1 lg:min-h-0">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-4 lg:space-y-6 lg:overflow-y-auto lg:pr-2">
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
                                            const preset = findPresetById(val, DEFAULT_PRESETS_CONFIG);
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
                                            {isPresetId(selectedModel)
                                                ? getPresetDisplayName(findPresetById(selectedModel, DEFAULT_PRESETS_CONFIG)!, t)
                                                : selectedModel || t('server.select_model_placeholder')
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Presets Group */}
                                        <SelectGroup>
                                            <SelectLabel>{t('tray.presets_group')}</SelectLabel>
                                            {getAllPresets(DEFAULT_PRESETS_CONFIG).map(preset => (
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
                        </CardContent>
                    </Card>

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
                                                    <SelectItem value="powersaver">Power Saver</SelectItem>
                                                    <SelectItem value="balanced">Balanced</SelectItem>
                                                    <SelectItem value="performance">Performance</SelectItem>
                                                    <SelectItem value="turbo">Turbo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
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
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <label className="block text-xs font-medium text-muted-foreground">{t('server.context_tokens')}</label>
                                                    <InfoTooltip text={t('server.context_tokens_desc')} />
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={options.ctxLen || ""}
                                                    onChange={(e) => handleOptionChange('ctxLen', parseInt(e.target.value) || 0)}
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

                {/* Logs Panel - Accordion on mobile, normal on desktop */}
                <div className="lg:col-span-2 lg:h-full lg:min-h-0">
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
        </div>
    );
};
