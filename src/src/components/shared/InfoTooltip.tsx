import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface InfoTooltipProps {
    text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    if (!text) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Info size={14} className="text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
                <p className="max-w-xs">{text}</p>
            </TooltipContent>
        </Tooltip>
    );
}
