import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

interface GenericAlertDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description: string;
    confirmText?: string;
    onConfirm?: () => void;
}

export function GenericAlertDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmText,
    onConfirm,
}: GenericAlertDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title || t('common.alert')}</DialogTitle>
                    <DialogDescription className="pt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={() => {
                        onOpenChange(false);
                        if (onConfirm) onConfirm();
                    }}>
                        {confirmText || "OK"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
