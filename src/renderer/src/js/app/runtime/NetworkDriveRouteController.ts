import type {AppView} from '@js/shared/types/AppContracts';
import type {ContentUIFacade} from './ui/ContentUIFacade';

interface NetworkDriveLike {
    id: string | number;
    [key: string]: any;
}

export interface NetworkDriveRouteHost {
    currentView: AppView;
}

interface NetworkDriveViewRouter {
    hideAllPages(): void;
    updateSidebarSelection(type: string, id?: string | null): void;
}

interface NetworkDriveLibrary {
    refreshLibrary(): Promise<void>;
}

interface NetworkDriveRouteControllerOptions {
    app: NetworkDriveRouteHost;
    library: NetworkDriveLibrary;
    content: ContentUIFacade;
    viewRouter: NetworkDriveViewRouter;
}

export class NetworkDriveRouteController {
    private readonly app: NetworkDriveRouteHost;
    private readonly library: NetworkDriveLibrary;
    private readonly content: ContentUIFacade;
    private readonly viewRouter: NetworkDriveViewRouter;

    constructor({app, library, content, viewRouter}: NetworkDriveRouteControllerOptions) {
        this.app = app;
        this.library = library;
        this.content = content;
        this.viewRouter = viewRouter;
    }

    async handleNetworkDriveSelected(drive: unknown): Promise<void> {
        const networkDrive = drive as NetworkDriveLike;

        this.viewRouter.hideAllPages();
        this.viewRouter.updateSidebarSelection('network-drive', String(networkDrive.id));
        this.app.currentView = 'network-drive-detail';
        await this.content.showNetworkDriveDetail(networkDrive);
    }

    async handleDriveRemoved(): Promise<void> {
        await this.content.loadNetworkDrives();
        await this.library.refreshLibrary();
    }
}
