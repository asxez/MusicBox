type SettingsEventTarget = EventTarget & {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean): void;
};

interface ScopedListener {
    target: SettingsEventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions | boolean;
}

export interface SettingsListenerScope {
    listen(
        target: SettingsEventTarget | null | undefined,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ): void;
}

export class ManagedSettingsListenerScope implements SettingsListenerScope {
    private readonly listeners: ScopedListener[] = [];

    listen(
        target: SettingsEventTarget | null | undefined,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ): void {
        if (!target) {
            return;
        }

        target.addEventListener(type, handler, options);
        this.listeners.push({target, type, handler, options});
    }

    dispose(): void {
        this.listeners.forEach(({target, type, handler, options}) => {
            try {
                target.removeEventListener(type, handler, options);
            } catch (error) {
                console.warn('⚠️ SettingsListenerScope: 移除设置页事件监听失败:', error);
            }
        });
        this.listeners.length = 0;
    }
}
