import type {AppView, ConfirmOptions} from "@js/shared/types/AppContracts";

export interface AppShellRuntimeHost {
    confirm(options: ConfirmOptions): Promise<boolean>;
    showInfo(message: string): void;
    showSuccess(message: string): void;
    showError(message: string): void;
    handleViewChange(view: AppView): Promise<void>;
    addMusicFiles(): Promise<void>;
    showNetworkDriveModal(): boolean;
    showPluginManager(): Promise<boolean>;
}

class AppShellRuntimeHostService {
    private host: AppShellRuntimeHost | null = null;

    bindApp(host: AppShellRuntimeHost): void {
        this.host = host;
    }

    getOptionalHost(): AppShellRuntimeHost | null {
        return this.host;
    }

    requireHost(): AppShellRuntimeHost {
        if (!this.host) {
            throw new Error('App shell runtime host has not been bound');
        }

        return this.host;
    }
}

export const appShellRuntimeHost = new AppShellRuntimeHostService();
