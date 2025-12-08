import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Centralized notification service that only sends notifications
 * when the application window is not visible (minimized to tray).
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
     * Send a notification only if the window is not visible.
     * This prevents notifications when the user is actively using the app.
     */
    async send(title: string, body: string): Promise<void> {
        try {
            const window = getCurrentWindow();
            const isVisible = await window.isVisible();

            // Only notify when window is not visible (minimized to tray)
            if (!isVisible) {
                sendNotification({ title, body });
            }
        } catch (error) {
            console.error("Failed to send notification:", error);
        }
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
