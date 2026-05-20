import {trayShellService, windowShellService} from "@/features/appShell/service";
import type {DOMEventBindingHost} from './AppRuntimePorts';
import type {ManagedDOMListener} from '@/shared/types/AppContracts';

interface DOMEventBinderOptions {
    app: DOMEventBindingHost;
    eventListeners: ManagedDOMListener[];
}

export class DOMEventBinder {
    private readonly app: DOMEventBindingHost;
    private readonly eventListeners: ManagedDOMListener[];

    constructor({app, eventListeners}: DOMEventBinderOptions) {
        this.app = app;
        this.eventListeners = eventListeners;
    }

    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({element, event, handler, options});
    }

    dispose(): void {
        windowShellService.disposeWindowStateManagement();

        this.eventListeners.forEach(({element, event, handler}) => {
            try {
                element.removeEventListener(event, handler);
            } catch (error) {
                console.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners.length = 0;
    }

    async bindAppEvents(): Promise<void> {
        const app = this.app;

        this.addManagedEventListener(window, 'beforeunload', async () => {
            await app.cleanup();
        });

        windowShellService.initWindowStateManagement();
        await trayShellService.initSystemTray();

        app.initKeyboardShortcuts();
        await app.initGlobalShortcuts();

        const addPlaylistBtn = document.getElementById('add-playlist-btn');
        if (addPlaylistBtn) {
            this.addManagedEventListener(addPlaylistBtn, 'click', () => {
                app.showCreatePlaylistDialog();
            });
        }

        app.setupFileLoading();
    }
}
