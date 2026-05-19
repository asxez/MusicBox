import type {ViewRouterHost} from './AppRuntimePorts';
import type {AppView} from '@js/shared/types/AppContracts';
import type {ContentUIFacade} from './ui/ContentUIFacade';

interface ViewRouterOptions {
    app: ViewRouterHost;
    content: ContentUIFacade;
}

export class ViewRouter {
    private readonly app: ViewRouterHost;
    private readonly content: ContentUIFacade;

    constructor({app, content}: ViewRouterOptions) {
        this.app = app;
        this.content = content;
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
                await this.content.showHomePage();
                break;
            case 'library':
                this.content.showTrackList();
                app.updateTrackList('navigation');
                break;
            case 'recent':
                await this.content.showRecentPage();
                break;
            case 'artists':
                await this.content.showArtistsPage();
                break;
            case 'albums':
                await this.content.showAlbumsPage();
                break;
            case 'statistics':
                await this.content.showStatisticsPage();
                break;
            case 'playlist-detail':
                break;
            default:
                console.warn('Unknown view:', view);
                if (app.currentView !== 'playlist-detail') {
                    this.content.showTrackList();
                    app.updateTrackList('default-fallback');
                }
                break;
        }
    }

    hideAllPages(): void {
        this.content.hideAllPages();
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        this.content.updateSidebarSelection(type, id);
    }
}
