import { Activity, Box, Settings, Info } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon, label, active, onClick }: SidebarItemProps) => (
    <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
            "w-full justify-start gap-4 px-6 py-3 rounded-lg transition-all duration-200",
            active
                ? "bg-blue-600/10 text-blue-500  hover:bg-blue-600/20 hover:text-blue-400"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground  border-transparent"
        )}
    >
        {icon}
        <span className="font-medium text-sm">{label}</span>
    </Button>
);

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
    const { t } = useTranslation();
    return (
        <aside className="w-50 bg-card border-r border-border flex flex-col py-6">
            <div className="px-8 mb-5">
                <h1 className="flex items-center gap-3 justify-center tracking-tight">
                    <img src="/logo.png" alt="Logo" className="h-16 w-16" />
                </h1>
            </div>
            <nav className="flex-1 space-y-1 p-2">
                {/* <SidebarItem
                    icon={<LayoutDashboard size={22} />}
                    label={t('sidebar.chat')}
                    active={activeTab === "chat"}
                    onClick={() => setActiveTab("chat")}
                /> */}
                <SidebarItem
                    icon={<Box size={22} />}
                    label={t('sidebar.models')}
                    active={activeTab === "models"}
                    onClick={() => setActiveTab("models")}
                />
                <SidebarItem
                    icon={<Activity size={22} />}
                    label={t('sidebar.server')}
                    active={activeTab === "server"}
                    onClick={() => setActiveTab("server")}
                />
                <SidebarItem
                    icon={<Settings size={22} />}
                    label={t('sidebar.settings')}
                    active={activeTab === "settings"}
                    onClick={() => setActiveTab("settings")}
                />
                <SidebarItem
                    icon={<Info size={22} />}
                    label={t('sidebar.about')}
                    active={activeTab === "about"}
                    onClick={() => setActiveTab("about")}
                />
            </nav>
        </aside>
    );
};
