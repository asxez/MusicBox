import {app} from "@core/app";
import type {ConfirmOptions} from "@core/types/app";

class PluginManagerInteractionService {
    confirm(options: ConfirmOptions): Promise<boolean> {
        return app.confirm(options);
    }
}

export const pluginManagerInteractionService = new PluginManagerInteractionService();
