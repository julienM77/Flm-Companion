import { toast as sonnerToast } from "sonner";

export const ToastService = {
    success(title: string, description?: string) {
        sonnerToast.success(title, { description });
    },

    error(title: string, description?: string) {
        sonnerToast.error(title, { description });
    },

    info(title: string, description?: string) {
        sonnerToast.info(title, { description });
    },

    loading(title: string, description?: string) {
        return sonnerToast.loading(title, { description });
    },

    // Permet de dismiss un toast spécifique
    dismiss(id: string | number) {
        sonnerToast.dismiss(id);
    }
};
