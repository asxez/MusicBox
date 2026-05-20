import {appShellRuntimeHost} from "./AppShellRuntimeHost";

export class AppModalService {
    showNetworkDriveModal(): boolean {
        return appShellRuntimeHost.getOptionalHost()?.showNetworkDriveModal() ?? false;
    }

    async showPluginManager(): Promise<boolean> {
        return await appShellRuntimeHost.getOptionalHost()?.showPluginManager() ?? false;
    }
}

export const appModalService = new AppModalService();
