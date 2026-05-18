import {shortcutDialogService} from "./ShortcutDialogService";
import type {ShortcutDefinition, ShortcutMap, ShortcutType} from "./ShortcutSettingsService";

interface ShortcutListRenderOptions {
    container: HTMLElement | null | undefined;
    type: ShortcutType;
    shortcuts: ShortcutMap;
    onRecord: (type: ShortcutType, id: string, keyElement: HTMLElement) => void;
    onToggle: (type: ShortcutType, id: string, enabled: boolean) => void;
}

class ShortcutListRenderer {
    render({container, type, shortcuts, onRecord, onToggle}: ShortcutListRenderOptions): void {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        Object.entries(shortcuts).forEach(([id, shortcut]) => {
            container.appendChild(this.createShortcutItem({
                type,
                id,
                shortcut,
                onRecord,
                onToggle
            }));
        });
    }

    formatKey(key: string): string {
        if (!key) {
            return '未设置';
        }

        return shortcutDialogService.formatShortcutKey(key);
    }

    updateShortcutKey(type: ShortcutType, id: string, shortcutString: string): void {
        const keyElement = document.querySelector<HTMLElement>(this.getShortcutKeySelector(type, id));
        if (keyElement) {
            keyElement.textContent = this.formatKey(shortcutString);
        }
    }

    updateShortcutEnabled(type: ShortcutType, id: string, enabled: boolean): void {
        const keyElement = document.querySelector<HTMLElement>(this.getShortcutKeySelector(type, id));
        if (!keyElement) {
            return;
        }

        keyElement.classList.toggle('disabled', !enabled);
    }

    updateGlobalShortcutsVisibility(globalShortcutsGroup: HTMLElement | null | undefined, visible: boolean): void {
        globalShortcutsGroup?.classList.toggle('hidden', !visible);
    }

    private createShortcutItem(options: {
        type: ShortcutType;
        id: string;
        shortcut: ShortcutDefinition;
        onRecord: (type: ShortcutType, id: string, keyElement: HTMLElement) => void;
        onToggle: (type: ShortcutType, id: string, enabled: boolean) => void;
    }): HTMLElement {
        const {type, id, shortcut, onRecord, onToggle} = options;
        const item = document.createElement('div');
        item.className = 'shortcut-item';

        const info = document.createElement('div');
        info.className = 'shortcut-info';

        const name = document.createElement('div');
        name.className = 'shortcut-name';
        name.textContent = shortcut.name;

        const description = document.createElement('div');
        description.className = 'shortcut-description';
        description.textContent = shortcut.description;

        info.appendChild(name);
        info.appendChild(description);

        const controls = document.createElement('div');
        controls.className = 'shortcut-controls';

        const key = document.createElement('div');
        key.className = `shortcut-key ${shortcut.enabled ? '' : 'disabled'}`.trim();
        key.dataset.type = type;
        key.dataset.id = id;
        key.title = '点击修改快捷键';
        key.textContent = this.formatKey(shortcut.key);
        key.addEventListener('click', () => {
            if (!key.classList.contains('disabled')) {
                onRecord(type, id, key);
            }
        });

        const toggle = document.createElement('div');
        toggle.className = 'shortcut-toggle';

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = 'toggle-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `shortcut-${type}-${id}`;
        input.className = 'toggle-input';
        input.checked = shortcut.enabled;
        input.dataset.type = type;
        input.dataset.id = id;
        input.addEventListener('change', () => onToggle(type, id, input.checked));

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.className = 'toggle-label';

        toggleSwitch.appendChild(input);
        toggleSwitch.appendChild(label);
        toggle.appendChild(toggleSwitch);
        controls.appendChild(key);
        controls.appendChild(toggle);
        item.appendChild(info);
        item.appendChild(controls);

        return item;
    }

    private getShortcutKeySelector(type: ShortcutType, id: string): string {
        return `[data-type="${type}"][data-id="${id}"].shortcut-key`;
    }
}

export const shortcutListRenderer = new ShortcutListRenderer();
