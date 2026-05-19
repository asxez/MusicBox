import {appShellRuntimeHost} from "./AppShellRuntimeHost";

export class AppFileImportActionService {
    addMusicFiles(): Promise<void> {
        return appShellRuntimeHost.requireHost().addMusicFiles();
    }
}

export const appFileImportActionService = new AppFileImportActionService();
