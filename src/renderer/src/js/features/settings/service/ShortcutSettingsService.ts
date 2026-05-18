import {
    shortcutConfig,
    type ShortcutConflict,
    type ShortcutDefinition,
    type ShortcutMap,
    type ShortcutType
} from "@utils/shortcuts/ShortcutConfig";
import {shortcutRecorder} from "@utils/shortcuts/ShortcutRecorder";

export type {
    ShortcutConflict,
    ShortcutDefinition,
    ShortcutMap,
    ShortcutType
};

class ShortcutSettingsService {
    getConfig() {
        return shortcutConfig.getConfig();
    }

    initializeCollapsibleShortcuts(delay = 100): void {
        setTimeout(() => {
            shortcutConfig.initializeCollapsibleShortcuts();
        }, delay);
    }

    startRecording(element: HTMLElement, onRecorded: (shortcutString: string) => void | Promise<void>): void {
        shortcutRecorder.startRecording(element);

        const handleRecorded = async (shortcutString: string) => {
            await onRecorded(shortcutString);
            shortcutRecorder.off('shortcutRecorded', handleRecorded);
        };

        shortcutRecorder.on('shortcutRecorded', handleRecorded);
    }

    checkConflicts(type: ShortcutType, id: string, shortcutString: string): ShortcutConflict[] {
        return shortcutConfig.checkConflicts(type, id, shortcutString);
    }

    updateShortcut(type: ShortcutType, id: string, shortcutString: string): Promise<boolean> {
        return shortcutConfig.updateShortcut(type, id, shortcutString);
    }

    setShortcutEnabled(type: ShortcutType, id: string, enabled: boolean): boolean {
        return shortcutConfig.setShortcutEnabled(type, id, enabled);
    }

    async setGlobalShortcutsEnabled(enabled: boolean): Promise<boolean> {
        return shortcutConfig.setGlobalShortcutsEnabled(enabled);
    }

    resetToDefaults(): boolean {
        return shortcutConfig.resetToDefaults();
    }

    refreshSummary(): void {
        shortcutConfig.refreshSummary();
    }
}

export const shortcutSettingsService = new ShortcutSettingsService();
