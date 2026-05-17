import type {AppView, RendererAppContext} from '@core/types/app';
import {AppUIFacade} from '@core/ui/AppUIFacade';

interface ViewRouterOptions {
    app: RendererAppContext;
}

export class ViewRouter {
    private readonly app: RendererAppContext;
    private readonly ui: AppUIFacade;

    constructor({app}: ViewRouterOptions) {
        this.app = app;
        this.ui = new AppUIFacade(app);
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
