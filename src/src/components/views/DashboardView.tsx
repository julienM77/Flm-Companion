import { Square, Cpu, Play, Download, Settings } from "lucide-react";
import { SystemService } from "../../services/system";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ServerStatus, DEFAULT_SERVER_PORT } from "../../types";

interface DashboardViewProps {
    serverStatus: ServerStatus;
    onToggleServer: () => void;
    flmVersion: string;
    selectedModel: string;
    onNavigate: (tab: string) => void;
}

export const DashboardView = ({
    serverStatus,
    onToggleServer,
    flmVersion,
    selectedModel,
    onNavigate
}: DashboardViewProps) => {
    const [npuVersion, setNpuVersion] = useState("Détection...");
    const [stats, setStats] = useState<{
        history: { time: string; cpu: number; memory: number }[];
        current: { memory: { used: number; total: number; percentage: number }; cpu: { usage: number }; npu: { usage: number; temperature: number; power: number } };
    }>({
        history: Array(20).fill({ time: '', cpu: 0, memory: 0 }),
        current: {
            memory: { used: 0, total: 0, percentage: 0 },
            cpu: { usage: 0 },
            npu: { usage: 0, temperature: 0, power: 0 }
        }
    });

    useEffect(() => {
        SystemService.getNpuDriverVersion().then(setNpuVersion);

        const interval = setInterval(async () => {
            const data = await SystemService.getSystemStats();
            const time = new Date().toLocaleTimeString();

            setStats(prev => {
                const newHistory = [...prev.history.slice(1), {
                    time,
                    cpu: data.cpu.usage,
                    memory: data.memory.percentage
                }];
                return {
                    history: newHistory,
                    current: data
                };
            });
        }, 2000);

        return () => clearInterval(interval);
    }, []); return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Vue d'ensemble</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Server Status Card */}
                    <Card className="flex flex-col bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-medium text-foreground">Serveur FLM</CardTitle>
                                <CardDescription className="text-muted-foreground">Port: {DEFAULT_SERVER_PORT} • v{flmVersion}</CardDescription>
                            </div>
                            <Badge variant={
                                serverStatus === "running" ? "default" :
                                    serverStatus === "starting" ? "secondary" :
                                        "destructive"
                            } className={
                                serverStatus === "running" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20" :
                                    serverStatus === "starting" ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20" :
                                        "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                            }>
                                {serverStatus === "running" ? "EN LIGNE" : serverStatus === "starting" ? "DÉMARRAGE..." : "ARRÊTÉ"}
                            </Badge>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <div className="flex-1 flex items-center justify-center py-8">
                                {serverStatus === "running" ? (
                                    <div className="text-center">
                                        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Modèle actif</div>
                                        <div className="text-2xl font-bold text-foreground tracking-tight">{selectedModel}</div>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground text-sm">
                                        Le serveur est arrêté.
                                        <br />
                                        Configurez-le dans l'onglet Serveur.
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-4">
                                {serverStatus === "running" && (
                                    <Button
                                        variant="destructive"
                                        onClick={onToggleServer}
                                        className="w-full gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                    >
                                        <Square size={16} /> Arrêter le serveur
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* System Status Card */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-medium text-foreground">Système</CardTitle>
                                <CardDescription className="text-muted-foreground">Driver: {npuVersion}</CardDescription>
                            </div>
                            <div className="bg-purple-500/10 p-2 rounded-lg">
                                <Cpu className="text-purple-500 h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6 mt-2">
                                {/* CPU Graph */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Utilisation CPU</span>
                                        <span className="text-foreground font-mono">{stats.current.cpu.usage}%</span>
                                    </div>
                                    <div className="h-24 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats.history}>
                                                <defs>
                                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="cpu" stroke="#a855f7" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} isAnimationActive={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Memory Graph */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Mémoire Système</span>
                                        <span className="text-foreground font-mono">{Math.round(stats.current.memory.used / 1024)} / {Math.round(stats.current.memory.total / 1024)} GB</span>
                                    </div>
                                    <div className="h-24 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats.history}>
                                                <defs>
                                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="memory" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMem)" strokeWidth={2} isAnimationActive={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">NPU (Simulé)</div>
                                        <div className="text-lg font-semibold text-foreground">--</div>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Puissance</div>
                                        <div className="text-lg font-semibold text-foreground">-- W</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Actions rapides</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-3 bg-card border-border hover:bg-accent hover:text-accent-foreground transition-all"
                        onClick={() => onNavigate("server")}
                    >
                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                            <Play size={20} />
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-foreground">Démarrer le serveur</div>
                            <div className="text-xs text-muted-foreground mt-1">Lancer l'API locale</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-3 bg-card border-border hover:bg-accent hover:text-accent-foreground transition-all"
                        onClick={() => onNavigate("models")}
                    >
                        <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500">
                            <Download size={20} />
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-foreground">Gérer les modèles</div>
                            <div className="text-xs text-muted-foreground mt-1">Télécharger & configurer</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-3 bg-card border-border hover:bg-accent hover:text-accent-foreground transition-all"
                        onClick={() => onNavigate("settings")}
                    >
                        <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                            <Settings size={20} />
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-foreground">Paramètres</div>
                            <div className="text-xs text-muted-foreground mt-1">Configuration avancée</div>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );
};
