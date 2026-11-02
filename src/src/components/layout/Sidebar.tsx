import { Activity, Box, MessageSquare, Settings, Info, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useState } from "react";

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    collapsed: boolean;
}

const SidebarItem = ({ icon, label, active, onClick, collapsed }: SidebarItemProps) => {
    const button = (
        <Button
            variant="ghost"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "w-full rounded-lg transition-all duration-200",
                collapsed ? "justify-center px-0" : "justify-start gap-4 px-6",
                "py-3",
                active
                    ? "bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 hover:text-blue-400"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border-transparent"
            )}
        >
            {icon}
            {!collapsed && <span className="font-medium text-sm">{label}</span>}
        </Button>
    );

    if (!collapsed) return button;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
    );
};

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");

    const toggleCollapsed = () => {
        setCollapsed((current) => {
            const next = !current;
            localStorage.setItem("sidebar-collapsed", String(next));
            return next;
        });
    };

    return (
        <aside className={cn(
            "bg-card border-r border-border flex flex-col py-6 transition-[width] duration-200",
            collapsed ? "w-16" : "w-50"
        )}>
            <div className={cn("mb-5 flex", collapsed ? "justify-center" : "justify-between px-4")}>
                {!collapsed && (
                    <h1 className="flex items-center gap-3 tracking-tight">
                        <img src="/logo.png" alt="Logo" className="h-16 w-16" />
                    </h1>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </Button>
            </div>
            <nav className="flex-1 space-y-1 p-2">
                <SidebarItem
                    icon={<Activity size={22} />}
                    label={t('sidebar.server')}
                    active={activeTab === "server"}
                    onClick={() => setActiveTab("server")}
                    collapsed={collapsed}
                />
                <SidebarItem
                    icon={<MessageSquare size={22} />}
                    label={t('sidebar.chat')}
                    active={activeTab === "chat"}
                    onClick={() => setActiveTab("chat")}
                    collapsed={collapsed}
                />
                <SidebarItem
                    icon={<Box size={22} />}
                    label={t('sidebar.models')}
                    active={activeTab === "models"}
                    onClick={() => setActiveTab("models")}
                    collapsed={collapsed}
                />
                <SidebarItem
                    icon={<Settings size={22} />}
                    label={t('sidebar.settings')}
                    active={activeTab === "settings"}
                    onClick={() => setActiveTab("settings")}
                    collapsed={collapsed}
                />
                <SidebarItem
                    icon={<Info size={22} />}
                    label={t('sidebar.about')}
                    active={activeTab === "about"}
                    onClick={() => setActiveTab("about")}
                    collapsed={collapsed}
                />
            </nav>
        </aside>
    );
};
