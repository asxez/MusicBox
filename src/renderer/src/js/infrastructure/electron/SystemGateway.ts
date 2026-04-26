function getElectronAPI(): Window['electronAPI'] {
    if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
    }

    return window.electronAPI;
}

class SystemGateway {
    getVersion(): Promise<string> {
        return getElectronAPI().getVersion();
    }

    getPlatform(): Promise<string> {
        return getElectronAPI().getPlatform();
    }

    getAppPath(): Promise<string> {
        return getElectronAPI().getAppPath();
    }

    getUserDataPath(): Promise<string> {
        return getElectronAPI().getUserDataPath();
    }

    getTempPath(): Promise<string> {
        return getElectronAPI().getTempPath();
    }

    openPath(path: string): Promise<{success: boolean; error?: string}> {
        return getElectronAPI().openPath(path);
    }
}

export const systemGateway = new SystemGateway();
