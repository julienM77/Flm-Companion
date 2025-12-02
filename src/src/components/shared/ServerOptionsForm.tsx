import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useTranslation } from "react-i18next";
import type { ServerOptions, PerformanceMode } from "../../types";

interface ServerOptionsFormProps {
    options: ServerOptions;
    onChange: (key: keyof ServerOptions, value: ServerOptions[keyof ServerOptions]) => void;
    disabled?: boolean;
    /**
     * Which options to show
     * 'basic' = pmode, ctxLen, asr, embed
     * 'full' = all options including port, socket, qLen, cors, preemption
     */
    variant?: "basic" | "full";
}

const PERFORMANCE_MODES: { value: PerformanceMode; labelKey: string }[] = [
    { value: "powersaver", labelKey: "chat.power_modes.powersaver" },
    { value: "balanced", labelKey: "chat.power_modes.balanced" },
    { value: "performance", labelKey: "chat.power_modes.performance" },
    { value: "turbo", labelKey: "chat.power_modes.turbo" },
];

/**
 * Reusable form component for server options
 * Used in ChatView and ServerView
 */
export function ServerOptionsForm({
    options,
    onChange,
    disabled = false,
    variant = "basic",
}: ServerOptionsFormProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Performance Mode */}
            <div className="space-y-2">
                <Label>{t("chat.power_mode")}</Label>
                <Select
                    value={options.pmode}
                    onValueChange={(v: PerformanceMode) => onChange("pmode", v)}
                    disabled={disabled}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PERFORMANCE_MODES.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                                {t(mode.labelKey)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Context Length */}
            <div className="space-y-2">
                <Label>{t("chat.context_length")}</Label>
                <Input
                    type="number"
                    value={options.ctxLen || ""}
                    onChange={(e) => onChange("ctxLen", parseInt(e.target.value) || 0)}
                    disabled={disabled}
                />
            </div>

            {/* ASR Toggle */}
            <div className="flex items-center justify-between">
                <Label htmlFor="asr-mode">{t("chat.asr_mode")}</Label>
                <Switch
                    id="asr-mode"
                    checked={options.asr}
                    onChange={(e) => onChange("asr", e.target.checked)}
                    disabled={disabled}
                />
            </div>

            {/* Embed Toggle */}
            <div className="flex items-center justify-between">
                <Label htmlFor="embed-mode">{t("chat.embed_mode")}</Label>
                <Switch
                    id="embed-mode"
                    checked={options.embed}
                    onChange={(e) => onChange("embed", e.target.checked)}
                    disabled={disabled}
                />
            </div>

            {/* Full variant shows additional options */}
            {variant === "full" && (
                <>
                    {/* Port */}
                    <div className="space-y-2">
                        <Label>{t("server.port")}</Label>
                        <Input
                            type="number"
                            value={options.port}
                            onChange={(e) => onChange("port", parseInt(e.target.value))}
                            disabled={disabled}
                        />
                    </div>

                    {/* Socket connections */}
                    <div className="space-y-2">
                        <Label>{t("server.socket_conn")}</Label>
                        <Input
                            type="number"
                            value={options.socket}
                            onChange={(e) => onChange("socket", parseInt(e.target.value))}
                            disabled={disabled}
                        />
                    </div>

                    {/* Queue Length */}
                    <div className="space-y-2">
                        <Label>{t("server.queue_len")}</Label>
                        <Input
                            type="number"
                            value={options.qLen}
                            onChange={(e) => onChange("qLen", parseInt(e.target.value))}
                            disabled={disabled}
                        />
                    </div>

                    {/* CORS Toggle */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="cors-mode">{t("server.enable_cors")}</Label>
                        <Switch
                            id="cors-mode"
                            checked={options.cors}
                            onChange={(e) => onChange("cors", e.target.checked)}
                            disabled={disabled}
                        />
                    </div>

                    {/* Preemption Toggle */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="preemption-mode">{t("server.enable_preemption")}</Label>
                        <Switch
                            id="preemption-mode"
                            checked={options.preemption}
                            onChange={(e) => onChange("preemption", e.target.checked)}
                            disabled={disabled}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
