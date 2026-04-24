import {trayAPI, windowAPI} from "@js/api";

export class DOMEventBinder {
    constructor({eventListeners}) {
        this.eventListeners = eventListeners;
    }

    addManagedEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({element, event, handler, options});
    }

    async bindAppEvents(app) {
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
