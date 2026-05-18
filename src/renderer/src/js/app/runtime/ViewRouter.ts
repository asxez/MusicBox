import type {AppComponentPort, AppView, ViewRouterHost} from './AppRuntimeTypes';
import {AppUIFacade} from './AppUIFacade';

interface ViewRouterOptions {
    app: ViewRouterHost;
    components: AppComponentPort;
}

export class ViewRouter {
    private readonly app: ViewRouterHost;
    private readonly ui: AppUIFacade;

    constructor({app, components}: ViewRouterOptions) {
        this.app = app;
        this.ui = new AppUIFacade(components);
    }

    async handleViewChange(view: AppView): Promise<void> {
        const app = this.app;

        this.hideAllPages();
        app.currentView = view;

        if (view !== 'playlist-detail' && view !== 'network-drive-detail') {
            this.updateSidebarSelection(view);
        }

        switch (view) {
            case 'home-page':
                await this.ui.showHomePage();
                break;
            case 'library':
                this.ui.showTrackList();
                app.updateTrackList('navigation');
                break;
            case 'recent':
                await this.ui.showRecentPage();
                break;
            case 'artists':
                await this.ui.showArtistsPage();
                break;
            case 'albums':
                await this.ui.showAlbumsPage();
                break;
            case 'statistics':
                await this.ui.showStatisticsPage();
                break;
            case 'playlist-detail':
                break;
            default:
                console.warn('Unknown view:', view);
                if (app.currentView !== 'playlist-detail') {
                    this.ui.showTrackList();
                    app.updateTrackList('default-fallback');
                }
                break;
        }
    }

    hideAllPages(): void {
        this.ui.hideAllPages();
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        this.ui.updateSidebarSelection(type, id);
    }
}
