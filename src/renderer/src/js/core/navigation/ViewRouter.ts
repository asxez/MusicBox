import type {AppView, RendererAppContext} from '@core/types/app';

interface ViewRouterOptions {
    app: RendererAppContext;
}

export class ViewRouter {
    private readonly app: RendererAppContext;

    constructor({app}: ViewRouterOptions) {
        this.app = app;
    }

    async handleViewChange(view: AppView): Promise<void> {
        const app = this.app;
        const components = app.components;

        this.hideAllPages();
        app.currentView = view;

        if (view !== 'playlist-detail' && view !== 'network-drive-detail') {
            this.updateSidebarSelection(view);
        }

        switch (view) {
            case 'home-page':
                await components.homePage.show();
                break;
            case 'library':
                components.trackList.show();
                app.updateTrackList('navigation');
                break;
            case 'recent':
                if (components.recentPage) {
                    await components.recentPage.show();
                }
                break;
            case 'artists':
                if (components.artistsPage) {
                    await components.artistsPage.show();
                }
                break;
            case 'albums':
                if (components.albumsPage) {
                    await components.albumsPage.show();
                }
                break;
            case 'statistics':
                if (components.statisticsPage) {
                    await components.statisticsPage.show();
                }
                break;
            case 'playlist-detail':
                break;
            default:
                console.warn('Unknown view:', view);
                if (app.currentView !== 'playlist-detail') {
                    components.trackList.show();
                    app.updateTrackList('default-fallback');
                }
                break;
        }
    }

    hideAllPages(): void {
        const components = this.app.components;

        if (components.homePage) components.homePage.hide();
        if (components.recentPage) components.recentPage.hide();
        if (components.artistsPage) components.artistsPage.hide();
        if (components.albumsPage) components.albumsPage.hide();
        if (components.statisticsPage) components.statisticsPage.hide();
        if (components.playlistDetailPage) components.playlistDetailPage.hide();
        if (components.networkDriveDetailPage) components.networkDriveDetailPage.hide();
        if (components.trackList) components.trackList.hide();
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        document.querySelectorAll('.sidebar-link, .playlist-sidebar-item, .network-drive-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (type === 'playlist' && id) {
            const playlistItem = document.querySelector(`[data-playlist-id="${id}"]`);
            if (playlistItem) {
                playlistItem.classList.add('active');
            }
        } else if (type === 'network-drive' && id) {
            const driveItem = document.querySelector(`[data-drive-id="${id}"]`);
            if (driveItem) {
                driveItem.classList.add('active');
            }
        } else {
            const navItem = document.querySelector(`[data-view="${type}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
        }
    }
}
