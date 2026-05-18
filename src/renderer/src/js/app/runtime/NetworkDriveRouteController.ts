import type {AppView} from '@js/shared/types/AppContracts';
import type {AppUIFacade} from './AppUIFacade';

interface NetworkDriveLike {
    id: string | number;
    [key: string]: any;
}

interface NetworkDriveRouteHost {
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
    ui: AppUIFacade;
    viewRouter: NetworkDriveViewRouter;
}

export class NetworkDriveRouteController {
    private readonly app: NetworkDriveRouteHost;
    private readonly library: NetworkDriveLibrary;
    private readonly ui: AppUIFacade;
    private readonly viewRouter: NetworkDriveViewRouter;

    constructor({app, library, ui, viewRouter}: NetworkDriveRouteControllerOptions) {
        this.app = app;
        this.library = library;
        this.ui = ui;
        this.viewRouter = viewRouter;
    }

    async handleNetworkDriveSelected(drive: unknown): Promise<void> {
        const networkDrive = drive as NetworkDriveLike;

        this.viewRouter.hideAllPages();
        this.viewRouter.updateSidebarSelection('network-drive', String(networkDrive.id));
        this.app.currentView = 'network-drive-detail';
        await this.ui.showNetworkDriveDetail(networkDrive);
    }

    async handleDriveRemoved(): Promise<void> {
        await this.ui.loadNetworkDrives();
        await this.library.refreshLibrary();
    }
}
