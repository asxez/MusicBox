import {trayAPI, windowAPI} from "@js/api";
import type {ManagedDOMListener, RendererAppContext} from '@core/types/app';

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
        windowAPI.disposeWindowStateManagement();

        this.eventListeners.forEach(({element, event, handler}) => {
            try {
                element.removeEventListener(event, handler);
            } catch (error) {
                console.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners.length = 0;
    }

    async bindAppEvents(app: RendererAppContext): Promise<void> {
        this.addManagedEventListener(window, 'beforeunload', async () => {
            await app.cleanup();
        });

        windowAPI.initWindowStateManagement();
        await trayAPI.initSystemTray();

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
