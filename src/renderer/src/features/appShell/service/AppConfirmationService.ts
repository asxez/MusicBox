import type {ConfirmOptions} from "@/shared/types/AppContracts";
import {appShellRuntimeHost} from "./AppShellRuntimeHost";

export class AppConfirmationService {
    confirm(options: ConfirmOptions): Promise<boolean> {
        return appShellRuntimeHost.requireHost().confirm(options);
    }
}

export const appConfirmationService = new AppConfirmationService();
