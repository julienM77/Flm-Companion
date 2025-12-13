import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ToastService } from "./toast";

type NotificationType = "success" | "error" | "info" | "loading";

/**
 * Centralized notification service that sends toasts when the app is visible,
 * and system notifications when it's hidden (minimized to tray).
 */
export const NotificationService = {
    /**
     * Initialize notification permissions.
     * Should be called once at app startup.
     */
    async init(): Promise<boolean> {
        try {
            let permission = await isPermissionGranted();
            if (!permission) {
                const result = await requestPermission();
                permission = result === "granted";
            }
            return permission;
        } catch (error) {
            console.error("Failed to initialize notifications:", error);
            return false;
        }
    },

    /**
     * Send a notification or toast based on window visibility.
     * - Window visible: Shows an in-app toast
     * - Window hidden: Shows a system notification
     */
    async send(title: string, body: string, type?: NotificationType): Promise<void> {
        try {
            const window = getCurrentWindow();
            const isVisible = await window.isVisible();

            if (isVisible) {
                // Window visible → Show toast
                this.sendToast(title, body, type);
            } else {
                // Window hidden → Show system notification
                sendNotification({ title, body });
            }
        } catch (error) {
            console.error("Failed to send notification:", error);
        }
    },

    /**
     * Sends an in-app toast notification.
     * Auto-detects the type based on content if not specified.
     */
    sendToast(title: string, body: string, type?: NotificationType): void {
        const toastType = type || this.detectType(title, body);

        switch (toastType) {
            case "error":
                ToastService.error(title, body);
                break;
            case "info":
                ToastService.info(title, body);
                break;
            case "loading":
                ToastService.loading(title, body);
                break;
            default:
                ToastService.success(title, body);
        }
    },

    /**
     * Auto-detect notification type based on content.
     */
    detectType(title: string, body: string): NotificationType {
        const combined = `${title} ${body}`.toLowerCase();

        if (combined.includes("error") || combined.includes("failed")) {
            return "error";
        }
        if (combined.includes("starting") || combined.includes("downloading")) {
            return "info";
        }
        return "success";
    },

    /**
     * Force send a notification regardless of window visibility.
     * Use sparingly, only for critical alerts.
     */
    async sendAlways(title: string, body: string): Promise<void> {
        try {
            sendNotification({ title, body });
        } catch (error) {
            console.error("Failed to send notification:", error);
        }
    }
};
