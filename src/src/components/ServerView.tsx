import { useEffect, useRef } from "react";
import { Play, Square, Activity, Terminal, Mic, Cpu, Sliders } from "lucide-react";
import { FlmModel, ServerOptions } from "../services/flm";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useTranslation } from "react-i18next";

interface ServerViewProps {
    serverStatus: "stopped" | "running" | "starting";
    onToggleServer: (options: ServerOptions) => void;
    models: FlmModel[];
    selectedModel: string;
    onSelectModel: (model: string) => void;
    logs: string[];
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
    options,
    setOptions
}: ServerViewProps) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Update default context length when model changes
    useEffect(() => {
        if (selectedModel) {
            const model = models.find(m => m.name === selectedModel);
            // Only update if ctxLen is 0 (default) or if we want to force update on model change
            // But user might have customized it. 
            // Let's only update if the current value is 0 or undefined
            if (model && model.contextLength && (!options.ctxLen || options.ctxLen === 0)) {
                setOptions(prev => ({ ...prev, ctxLen: model.contextLength }));
            }
        }
    }, [selectedModel, models]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleOptionChange = (key: keyof ServerOptions, value: any) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('server.title')}</h2>
                    <p className="text-muted-foreground text-sm">{t('server.subtitle')}</p>
                </div>
                <Badge variant={
                    serverStatus === "running" ? "default" :
                        serverStatus === "starting" ? "secondary" :
                            "destructive"
                } className={`px-3 py-1 text-xs font-medium flex items-center gap-2 ${serverStatus === "running" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                    serverStatus === "starting" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                        "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === "running" ? "bg-green-500 animate-pulse" :
                        serverStatus === "starting" ? "bg-yellow-500 animate-bounce" :
                            "bg-red-500"
                        }`} />
                    {serverStatus === "running" ? t('server.status_online') : serverStatus === "starting" ? t('server.status_starting') : t('server.status_stopped')}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
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
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.model_to_load')}</label>
                                <Select
                                    value={selectedModel}
                                    onValueChange={onSelectModel}
                                    disabled={serverStatus !== "stopped"}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('server.select_model_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.length === 0 ? (
                                            <SelectItem value="none" disabled>{t('server.no_model_installed')}</SelectItem>
                                        ) : (
                                            models.map(m => (
                                                <SelectItem key={m.name} value={m.name}>
                                                    {m.name} ({m.size})
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Features Panel */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Mic size={16} className="text-muted-foreground" />
                                {t('server.features')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-foreground">{t('server.enable_asr')}</span>
                                <Switch
                                    checked={options.asr}
                                    onChange={(e) => handleOptionChange('asr', e.target.checked)}
                                    disabled={serverStatus !== "stopped"}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-foreground">{t('server.enable_embeddings')}</span>
                                <Switch
                                    checked={options.embed}
                                    onChange={(e) => handleOptionChange('embed', e.target.checked)}
                                    disabled={serverStatus !== "stopped"}
                                />
                            </div>
                        </CardContent>
                    </Card>

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
                                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.power_mode')}</label>
                                            <Select
                                                value={options.pmode}
                                                onValueChange={(value) => handleOptionChange('pmode', value)}
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
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.port')}</label>
                                                <Input
                                                    type="number"
                                                    value={options.port}
                                                    onChange={(e) => handleOptionChange('port', parseInt(e.target.value))}
                                                    disabled={serverStatus !== "stopped"}
                                                    className="bg-input border-input text-foreground h-9"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.context_tokens')}</label>
                                                <Input
                                                    type="number"
                                                    value={options.ctxLen}
                                                    onChange={(e) => handleOptionChange('ctxLen', parseInt(e.target.value))}
                                                    disabled={serverStatus !== "stopped"}
                                                    className="bg-input border-input text-foreground h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.socket_conn')}</label>
                                                <Input
                                                    type="number"
                                                    value={options.socket}
                                                    onChange={(e) => handleOptionChange('socket', parseInt(e.target.value))}
                                                    disabled={serverStatus !== "stopped"}
                                                    className="bg-input border-input text-foreground h-9"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('server.queue_len')}</label>
                                                <Input
                                                    type="number"
                                                    value={options.qLen}
                                                    onChange={(e) => handleOptionChange('qLen', parseInt(e.target.value))}
                                                    disabled={serverStatus !== "stopped"}
                                                    className="bg-input border-input text-foreground h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">{t('server.enable_cors')}</span>
                                                <Switch
                                                    checked={options.cors}
                                                    onChange={(e) => handleOptionChange('cors', e.target.checked)}
                                                    disabled={serverStatus !== "stopped"}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">{t('server.enable_preemption')}</span>
                                                <Switch
                                                    checked={options.preemption}
                                                    onChange={(e) => handleOptionChange('preemption', e.target.checked)}
                                                    disabled={serverStatus !== "stopped"}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>

                    {/* Action Button */}
                    <div className="pt-2">
                        {serverStatus === "stopped" ? (
                            <Button
                                onClick={() => onToggleServer(options)}
                                disabled={!selectedModel}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg hover:shadow-green-900/20"
                            >
                                <Play size={20} /> {t('server.start_server')}
                            </Button>
                        ) : serverStatus === "starting" ? (
                            <Button
                                disabled
                                className="w-full bg-yellow-600/50 text-white py-6 rounded-xl flex items-center justify-center gap-2 font-bold text-lg cursor-wait"
                            >
                                <Activity size={20} className="animate-spin" /> {t('server.starting')}
                            </Button>
                        ) : (
                            <Button
                                variant="destructive"
                                onClick={() => onToggleServer(options)}
                                className="w-full py-6 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg hover:shadow-red-900/20 bg-red-600 hover:bg-red-700"
                            >
                                <Square size={20} /> {t('server.stop_server')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Logs Panel */}
                <Card className="lg:col-span-2 bg-muted border-border flex flex-col overflow-hidden shadow-inner h-full">
                    <CardHeader className="bg-card px-4 py-3 border-b border-border flex flex-row justify-between items-center space-y-0">
                        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Terminal size={16} className="text-muted-foreground" />
                            {t('server.logs_title')}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">{logs.length} {t('server.lines')}</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1">
                        {logs.length === 0 ? (
                            <div className="text-muted-foreground text-center mt-20 italic">
                                {t('server.waiting_logs')}
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className={`break-all ${log.includes("[ERROR]") ? "text-red-400" :
                                    log.includes("[FLM]") ? "text-blue-400" :
                                        log.includes("[SYSTEM]") ? "text-yellow-400" :
                                            "text-muted-foreground"
                                    }`}>
                                    {log}
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
