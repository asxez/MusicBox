import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Result, Unsubscribe} from '@api/types/common';
import type {WindowBounds} from '@api/types/window';

class WindowGateway extends ElectronNamespaceAdapter<'window'> {
    constructor() {
        super('window');
    }

    minimize(): Promise<void> {
        return this.call('minimize');
    }

    maximize(): Promise<void> {
        return this.call('maximize');
    }

    unmaximize(): Promise<void> {
        return this.call('unmaximize');
    }

    isMaximized(): Promise<boolean> {
        return this.call('isMaximized');
    }

    close(): Promise<void> {
        return this.call('close');
    }

    getPosition(): Promise<[number, number]> {
        return this.call('getPosition');
    }

    getSize(): Promise<[number, number]> {
        return this.call('getSize');
    }

    setSize(width: number, height: number): Promise<Result> {
        return this.call('setSize', width, height);
    }

    getBounds(): Promise<WindowBounds> {
        return this.call('getBounds');
    }

    setBounds(bounds: WindowBounds): Promise<Result<WindowBounds>> {
        return this.call('setBounds', bounds);
    }

    setBackgroundThrottling(allowed: boolean): Promise<void> {
        return this.call('setBackgroundThrottling', allowed);
    }

    setAlwaysOnTop(flag: boolean): Promise<boolean> {
        return this.call('setAlwaysOnTop', flag);
    }

    setResizable(resizable: boolean): Promise<boolean> {
        return this.call('setResizable', resizable);
    }

    setMaximizable(maximizable: boolean): Promise<boolean> {
        return this.call('setMaximizable', maximizable);
    }

    setMaximumSize(width: number, height: number): Promise<boolean> {
        return this.call('setMaximumSize', width, height);
    }

    setMiniModeWindowState(options: {
        enabled: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<Result<{
        size?: number[];
        minimumSize?: number[];
        maximumSize?: number[];
    }>> {
        return this.call('setMiniModeWindowState', options);
    }

    setSkipTaskbar(skip: boolean): Promise<boolean> {
        return this.call('setSkipTaskbar', skip);
    }

    setMinimumSize(width: number, height: number): Promise<boolean> {
        return this.call('setMinimumSize', width, height);
    }

    onMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return this.on('onMaximizedChanged', handler);
    }
}

export const windowGateway = new WindowGateway();
