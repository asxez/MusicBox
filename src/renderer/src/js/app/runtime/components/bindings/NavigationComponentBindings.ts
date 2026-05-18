import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {AppView} from "@js/shared/types/AppContracts";

import type {NavigationComponentBindingContext} from "./ComponentBindingTypes";

export function bindNavigationComponentEvents({
    app,
    components,
    ui
}: NavigationComponentBindingContext): void {
    components.search.on('searchResults', (results: Track[]) => {
        app.handleSearchResults(results);
    });

    components.search.on('searchCleared', () => {
        app.handleSearchCleared();
    });

    components.navigation.on('viewChanged', async (view: AppView) => {
        await app.handleViewChange(view);
    });

    components.navigation.on('showSettings', async () => {
        await ui.toggleSettings();
    });

    components.navigation.on('playlistSelected', async (playlist: Playlist) => {
        await app.handlePlaylistSelected(playlist);
    });

    components.navigation.on('networkDriveSelected', async (drive: unknown) => {
        await app.handleNetworkDriveSelected(drive);
    });

    components.navigation.on('showRenameDialog', (playlist: Playlist) => {
        ui.showRenamePlaylistDialog(playlist);
    });
}
