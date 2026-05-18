import type {AppView, ConfirmOptions} from "@js/shared/types/AppContracts";

export interface AppInteractionHost {
    confirm(options: ConfirmOptions): Promise<boolean>;
    showInfo(message: string): void;
    showSuccess(message: string): void;
    showError(message: string): void;
    handleViewChange(view: AppView): Promise<void>;
    addMusicFiles(): Promise<void>;
    showNetworkDriveModal(): boolean;
    showPluginManager(): Promise<boolean>;
}

export class AppInteractionService {
    private app: AppInteractionHost | null = null;

    bindApp(app: AppInteractionHost): void {
        this.app = app;
    }

    confirm(options: ConfirmOptions): Promise<boolean> {
        return this.requireApp().confirm(options);
    }

    showInfo(message: string): void {
        this.requireApp().showInfo(message);
    }

    showSuccess(message: string): void {
        this.requireApp().showSuccess(message);
    }

    showError(message: string): void {
        this.requireApp().showError(message);
    }

    navigateToLibrary(): Promise<void> {
        return this.requireApp().handleViewChange('library');
    }

    addMusicFiles(): Promise<void> {
        return this.requireApp().addMusicFiles();
    }

    showNetworkDriveModal(): boolean {
        return this.app?.showNetworkDriveModal() ?? false;
    }

    async showPluginManager(): Promise<boolean> {
        return await this.app?.showPluginManager() ?? false;
    }

    private requireApp(): AppInteractionHost {
        if (!this.app) {
            throw new Error('应用交互服务尚未绑定 App 上下文');
        }

        return this.app;
    }
}

export const appInteractionService = new AppInteractionService();
