import type {ConfirmOptions, RendererAppContext} from "@core/types/app";

class AppInteractionService {
    private app: RendererAppContext | null = null;

    bindApp(app: RendererAppContext): void {
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
        const app = this.app;
        if (!app) {
            return false;
        }

        const modal = app.components.networkDiskModal;
        if (!modal) {
            return false;
        }

        modal.show();
        return true;
    }

    async showPluginManager(): Promise<boolean> {
        const app = this.app;
        if (!app) {
            return false;
        }

        const modal = app.components.pluginManagerModal;
        if (!modal) {
            return false;
        }

        await modal.show();
        return true;
    }

    private requireApp(): RendererAppContext {
        if (!this.app) {
            throw new Error('应用交互服务尚未绑定 App 上下文');
        }

        return this.app;
    }
}

export const appInteractionService = new AppInteractionService();
