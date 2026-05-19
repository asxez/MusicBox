import {trayShellService, windowShellService} from "@js/features/appShell/service";
import type {DOMEventBindingHost} from './AppRuntimePorts';
import type {ManagedDOMListener} from '@js/shared/types/AppContracts';

interface DOMEventBinderOptions {
    eventListeners: ManagedDOMListener[];
}

export class DOMEventBinder {
    private readonly eventListeners: ManagedDOMListener[];

    constructor({eventListeners}: DOMEventBinderOptions) {
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

    async bindAppEvents(app: DOMEventBindingHost): Promise<void> {
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
