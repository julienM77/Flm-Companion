import { Card, CardContent } from "./ui/card";
import { Terminal } from "lucide-react";

interface LogsProps {
    logs: string[];
}

export const Logs = ({ logs }: LogsProps) => (
    <div className="h-full flex flex-col space-y-6">
        <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Logs Système</h2>
            <p className="text-zinc-400 text-sm">Historique complet des événements du serveur</p>
        </div>
        <Card className="flex-1 bg-[#09090b] border-zinc-800/50 overflow-hidden flex flex-col shadow-inner">
            <div className="bg-[#18181b] px-4 py-2 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                    <Terminal size={14} />
                    <span>console.log</span>
                </div>
                <span className="text-xs text-zinc-600">{logs.length} lignes</span>
            </div>
            <CardContent className="flex-1 p-4 font-mono text-xs text-zinc-300 overflow-auto space-y-1">
                {logs.length === 0 ? (
                    <p className="text-zinc-600 italic text-center mt-10">Aucun log pour le moment...</p>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`whitespace-pre-wrap break-all ${log.includes("[ERROR]") ? "text-red-400" :
                            log.includes("[FLM]") ? "text-blue-400" :
                                log.includes("[SYSTEM]") ? "text-yellow-400" :
                                    "text-zinc-400"
                            }`}>
                            <span className="text-zinc-700 mr-2 select-none">{index + 1}</span>
                            {log}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    </div>
);
