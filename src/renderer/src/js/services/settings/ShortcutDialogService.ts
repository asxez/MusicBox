import type {ConfirmOptions} from "@core/types/app";
import type {ShortcutConflict} from "@services/settings/ShortcutSettingsService";

class ShortcutDialogService {
    createConflictConfirmOptions(conflicts: ShortcutConflict[], newShortcut: string): ConfirmOptions {
        const conflictNames = conflicts.map((conflict) => {
            const typeName = conflict.type === 'local' ? '应用内' : '全局';
            return `${conflict.name} (${typeName})`;
        }).join('、');

        return {
            title: '快捷键冲突',
            message: `快捷键 "${this.formatShortcutKey(newShortcut)}" 与以下快捷键冲突：\n${conflictNames}\n\n是否要覆盖现有快捷键？`,
            confirmText: '覆盖',
            type: 'warning'
        };
    }

    createResetConfirmOptions(): ConfirmOptions {
        return {
            title: '重置快捷键',
            message: '确定要将所有快捷键重置为默认设置吗？\n\n此操作将清除您的所有自定义快捷键配置。',
            confirmText: '重置',
            type: 'warning'
        };
    }

    formatShortcutKey(key: string): string {
        if (!key) {
            return '未设置';
        }

        return key
            .replace(/Ctrl/g, 'Ctrl')
            .replace(/Alt/g, 'Alt')
            .replace(/Shift/g, 'Shift')
            .replace(/Cmd/g, '⌘')
            .replace(/ArrowUp/g, '↑')
            .replace(/ArrowDown/g, '↓')
            .replace(/ArrowLeft/g, '←')
            .replace(/ArrowRight/g, '→')
            .replace(/Space/g, '空格');
    }
}

export const shortcutDialogService = new ShortcutDialogService();
