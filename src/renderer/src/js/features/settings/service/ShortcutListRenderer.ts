import {shortcutDialogService} from "./ShortcutDialogService";
import type {ShortcutDefinition, ShortcutMap, ShortcutType} from "./ShortcutSettingsService";

interface ShortcutListRenderOptions {
    container: HTMLElement | null | undefined;
    type: ShortcutType;
    shortcuts: ShortcutMap;
}

export type ShortcutListAction =
    | {type: 'record'; shortcutType: ShortcutType; id: string; keyElement: HTMLElement}
    | {type: 'toggle'; shortcutType: ShortcutType; id: string; enabled: boolean};

const isShortcutType = (value: string | undefined): value is ShortcutType => value === 'local' || value === 'global';

const getShortcutMetadata = (element: HTMLElement): {shortcutType: ShortcutType; id: string} | null => {
    const shortcutType = element.dataset.type;
    const id = element.dataset.id;

    if (!isShortcutType(shortcutType) || !id) {
        return null;
    }

    return {shortcutType, id};
}

class ShortcutListRenderer {
    render({container, type, shortcuts}: ShortcutListRenderOptions): void {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        Object.entries(shortcuts).forEach(([id, shortcut]) => {
            container.appendChild(this.createShortcutItem({
                type,
                id,
                shortcut
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

    resolveAction(target: EventTarget | null): ShortcutListAction | null {
        if (!(target instanceof Element)) {
            return null;
        }

        const keyElement = target.closest<HTMLElement>('.shortcut-key');
        if (keyElement) {
            const metadata = getShortcutMetadata(keyElement);
            if (!metadata || keyElement.classList.contains('disabled')) {
                return null;
            }

            return {
                type: 'record',
                shortcutType: metadata.shortcutType,
                id: metadata.id,
                keyElement
            };
        }

        const input = target.closest<HTMLInputElement>('.shortcut-toggle input[type="checkbox"]');
        if (input) {
            const metadata = getShortcutMetadata(input);
            if (!metadata) {
                return null;
            }

            return {
                type: 'toggle',
                shortcutType: metadata.shortcutType,
                id: metadata.id,
                enabled: input.checked
            };
        }

        return null;
    }

    private createShortcutItem(options: {
        type: ShortcutType;
        id: string;
        shortcut: ShortcutDefinition;
    }): HTMLElement {
        const {type, id, shortcut} = options;
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
