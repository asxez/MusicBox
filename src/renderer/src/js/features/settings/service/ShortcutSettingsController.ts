import {showToast} from "@utils/index.js";
import {appConfirmationService} from "@js/features/appShell/service";
import {shortcutDialogService} from "./ShortcutDialogService";
import {shortcutListRenderer, type ShortcutListAction} from "./ShortcutListRenderer";
import {
    shortcutSettingsService,
    type ShortcutConflict,
    type ShortcutMap,
    type ShortcutType
} from "./ShortcutSettingsService";
import type {SettingsListenerScope} from "./SettingsListenerScope";

export interface ShortcutSettingsElements {
    globalShortcutsToggle: HTMLInputElement | null;
    resetShortcutsButton: HTMLElement | null;
    localShortcutsList: HTMLElement | null;
    globalShortcutsList: HTMLElement | null;
    globalShortcutsGroup: HTMLElement | null;
}

type ShortcutsUpdatedCallback = () => void;

class ShortcutSettingsController {
    initialize(elements: ShortcutSettingsElements, onShortcutsUpdated: ShortcutsUpdatedCallback, scope: SettingsListenerScope): void {
        scope.listen(elements.globalShortcutsToggle, 'change', async () => {
            await this.toggleGlobalShortcuts(elements, elements.globalShortcutsToggle?.checked ?? false, onShortcutsUpdated);
        });

        scope.listen(elements.resetShortcutsButton, 'click', async () => {
            await this.showResetShortcutsDialog(elements, onShortcutsUpdated);
        });

        this.bindShortcutListEvents(elements.localShortcutsList, onShortcutsUpdated, scope);
        this.bindShortcutListEvents(elements.globalShortcutsList, onShortcutsUpdated, scope);
        this.initializeShortcuts(elements);
    }

    private bindShortcutListEvents(
        container: HTMLElement | null,
        onShortcutsUpdated: ShortcutsUpdatedCallback,
        scope: SettingsListenerScope
    ): void {
        scope.listen(container, 'click', (event: Event) => {
            void this.handleShortcutListAction(shortcutListRenderer.resolveAction(event.target), onShortcutsUpdated);
        });

        scope.listen(container, 'change', (event: Event) => {
            void this.handleShortcutListAction(shortcutListRenderer.resolveAction(event.target), onShortcutsUpdated);
        });
    }

    private async handleShortcutListAction(
        action: ShortcutListAction | null,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): Promise<void> {
        if (!action) {
            return;
        }

        if (action.type === 'record') {
            this.startRecordingShortcut(action.shortcutType, action.id, action.keyElement, onShortcutsUpdated);
            return;
        }

        this.toggleShortcut(action.shortcutType, action.id, action.enabled, onShortcutsUpdated);
    }

    private initializeShortcuts(elements: ShortcutSettingsElements): void {
        const config = shortcutSettingsService.getConfig();

        if (elements.globalShortcutsToggle) {
            elements.globalShortcutsToggle.checked = config.enableGlobalShortcuts;
        }

        this.updateGlobalShortcutsVisibility(elements, config.enableGlobalShortcuts);
        this.renderShortcutsList(elements, 'local', config.localShortcuts);
        this.renderShortcutsList(elements, 'global', config.globalShortcuts);
        shortcutSettingsService.initializeCollapsibleShortcuts();
    }

    private renderShortcutsList(
        elements: ShortcutSettingsElements,
        type: ShortcutType,
        shortcuts: ShortcutMap
    ): void {
        const container = type === 'local' ? elements.localShortcutsList : elements.globalShortcutsList;
        shortcutListRenderer.render({
            container,
            type,
            shortcuts
        });
    }

    private startRecordingShortcut(
        type: ShortcutType,
        id: string,
        element: HTMLElement,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): void {
        shortcutSettingsService.startRecording(element, async (shortcutString: string) => {
            await this.handleShortcutRecorded(type, id, shortcutString, onShortcutsUpdated);
        });
    }

    private async handleShortcutRecorded(
        type: ShortcutType,
        id: string,
        shortcutString: string,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): Promise<void> {
        const conflicts = shortcutSettingsService.checkConflicts(type, id, shortcutString);
        if (conflicts.length > 0) {
            await this.showShortcutConflict(conflicts, shortcutString, async () => {
                await this.updateShortcut(type, id, shortcutString, onShortcutsUpdated);
            });
            return;
        }

        await this.updateShortcut(type, id, shortcutString, onShortcutsUpdated);
    }

    private async updateShortcut(
        type: ShortcutType,
        id: string,
        shortcutString: string,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): Promise<void> {
        try {
            const success = await shortcutSettingsService.updateShortcut(type, id, shortcutString);
            if (!success) {
                showToast('快捷键更新失败', 'error');
                return;
            }

            shortcutListRenderer.updateShortcutKey(type, id, shortcutString);
            showToast('快捷键已更新', 'success');
            onShortcutsUpdated();
        } catch (error) {
            console.error('❌ 更新快捷键失败:', error);
            showToast('快捷键更新失败', 'error');
        }
    }

    private toggleShortcut(
        type: ShortcutType,
        id: string,
        enabled: boolean,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): void {
        const success = shortcutSettingsService.setShortcutEnabled(type, id, enabled);
        if (!success) {
            showToast('快捷键状态更新失败', 'error');
            return;
        }

        shortcutListRenderer.updateShortcutEnabled(type, id, enabled);
        showToast(enabled ? '快捷键已启用' : '快捷键已禁用', 'success');
        onShortcutsUpdated();
    }

    private async toggleGlobalShortcuts(
        elements: ShortcutSettingsElements,
        enabled: boolean,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): Promise<void> {
        try {
            const success = await shortcutSettingsService.setGlobalShortcutsEnabled(enabled);
            if (!success) {
                showToast('全局快捷键设置失败', 'error');
                this.restoreGlobalShortcutsToggle(elements, !enabled);
                return;
            }

            this.updateGlobalShortcutsVisibility(elements, enabled);
            shortcutSettingsService.refreshSummary();
            showToast(enabled ? '全局快捷键已启用' : '全局快捷键已禁用', 'success');
            onShortcutsUpdated();
        } catch (error) {
            showToast('全局快捷键设置失败', 'error');
            this.restoreGlobalShortcutsToggle(elements, !enabled);
        }
    }

    private updateGlobalShortcutsVisibility(elements: ShortcutSettingsElements, visible: boolean): void {
        shortcutListRenderer.updateGlobalShortcutsVisibility(elements.globalShortcutsGroup, visible);
    }

    private async showShortcutConflict(
        conflicts: ShortcutConflict[],
        newShortcut: string,
        onConfirm: () => void | Promise<void>
    ): Promise<void> {
        const confirmed = await appConfirmationService.confirm(
            shortcutDialogService.createConflictConfirmOptions(conflicts, newShortcut)
        );

        if (confirmed) {
            await onConfirm();
        }
    }

    private async showResetShortcutsDialog(
        elements: ShortcutSettingsElements,
        onShortcutsUpdated: ShortcutsUpdatedCallback
    ): Promise<void> {
        const confirmed = await appConfirmationService.confirm(
            shortcutDialogService.createResetConfirmOptions()
        );

        if (confirmed) {
            this.resetShortcuts(elements, onShortcutsUpdated);
        }
    }

    private resetShortcuts(elements: ShortcutSettingsElements, onShortcutsUpdated: ShortcutsUpdatedCallback): void {
        const success = shortcutSettingsService.resetToDefaults();
        if (!success) {
            showToast('重置快捷键失败', 'error');
            return;
        }

        this.initializeShortcuts(elements);
        shortcutSettingsService.refreshSummary();
        showToast('快捷键已重置为默认设置', 'success');
        onShortcutsUpdated();
    }

    private restoreGlobalShortcutsToggle(elements: ShortcutSettingsElements, checked: boolean): void {
        if (elements.globalShortcutsToggle) {
            elements.globalShortcutsToggle.checked = checked;
        }
    }
}

export const shortcutSettingsController = new ShortcutSettingsController();
