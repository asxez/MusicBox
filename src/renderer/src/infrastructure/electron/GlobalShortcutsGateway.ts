import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Unsubscribe} from '@api/types/common';

class GlobalShortcutsGateway extends ElectronNamespaceAdapter<'globalShortcuts'> {
    constructor() {
        super('globalShortcuts');
    }

    register(shortcuts: unknown): Promise<void> {
        return this.call('register', shortcuts);
    }

    unregister(): Promise<boolean> {
        return this.call('unregister');
    }

    setEnabled(enabled: boolean): Promise<unknown> {
        return this.call('setEnabled', enabled);
    }

    isEnabled(): Promise<boolean> {
        return this.call('isEnabled');
    }

    onTriggered(handler: (...args: unknown[]) => void): Unsubscribe {
        return this.on('onTriggered', handler);
    }
}

export const globalShortcutsGateway = new GlobalShortcutsGateway();

