import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppComponentPort} from '../AppRuntimePorts';

export class ContentUIFacade {
    constructor(private readonly app: AppComponentPort) {}

    setTrackListTracks(tracks: Track[]): void {
        this.app.components.trackList?.setTracks(tracks);
    }

    showTrackList(): void {
        this.app.components.trackList?.show();
    }

    hideTrackList(): void {
        this.app.components.trackList?.hide();
    }

    clearTrackListSelection(): void {
        const trackList = this.app.components.trackList;
        if (!trackList) {
            return;
        }

        trackList.selectedTracks.clear();
        trackList.lastSelectedIndex = -1;
    }

    showContextMenu(
        x: number,
        y: number,
        track: Track,
        index: number,
        selectedTracks?: Set<number>
    ): void {
        this.app.components.contextMenu?.show(x, y, track, index, selectedTracks);
    }

    async showPlaylistDetail(playlist: Playlist): Promise<void> {
        await this.app.components.playlistDetailPage?.show(playlist);
    }

    async showNetworkDriveDetail(drive: unknown): Promise<void> {
        await this.app.components.networkDriveDetailPage?.show(drive as any);
    }

    async removeTrackFromPlaylistDetail(track: Track, index: number): Promise<boolean> {
        const playlistDetailPage = this.app.components.playlistDetailPage;
        if (!playlistDetailPage) {
            return false;
        }

        await playlistDetailPage.removeTrackFromPlaylist(track, index);
        return true;
    }

    async removeSelectedTracksFromPlaylistDetail(): Promise<boolean> {
        const playlistDetailPage = this.app.components.playlistDetailPage;
        if (!playlistDetailPage) {
            return false;
        }

        await playlistDetailPage.removeSelectedTracks();
        return true;
    }

    isPlaylistDetailVisible(): boolean {
        return Boolean(this.app.components.playlistDetailPage?.isVisible);
    }

    updatePlaylistDetailTrack(filePath: string, updatedData: Partial<Track>): boolean {
        const playlistDetailPage = this.app.components.playlistDetailPage;
        const playlistTrack = playlistDetailPage?.tracks.find((track) => track.filePath === filePath);
        if (!playlistTrack) {
            return false;
        }

        Object.assign(playlistTrack, updatedData);
        playlistDetailPage.render();
        return true;
    }

    async reloadPlaylistDetailTracks(): Promise<void> {
        await this.app.components.playlistDetailPage?.loadPlaylistTracks();
    }

    async showHomePage(): Promise<void> {
        await this.app.components.homePage?.show();
    }

    async showRecentPage(): Promise<void> {
        await this.app.components.recentPage?.show();
    }

    async showArtistsPage(): Promise<void> {
        await this.app.components.artistsPage?.show();
    }

    async showAlbumsPage(): Promise<void> {
        await this.app.components.albumsPage?.show();
    }

    async showStatisticsPage(): Promise<void> {
        await this.app.components.statisticsPage?.show();
    }

    hideAllPages(): void {
        this.app.components.homePage?.hide();
        this.app.components.recentPage?.hide();
        this.app.components.artistsPage?.hide();
        this.app.components.albumsPage?.hide();
        this.app.components.statisticsPage?.hide();
        this.app.components.playlistDetailPage?.hide();
        this.app.components.networkDriveDetailPage?.hide();
        this.hideTrackList();
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        this.app.components.navigation?.updateSidebarSelection?.(type, id);
    }

    async refreshNavigationPlaylists(): Promise<void> {
        await this.app.components.navigation?.refreshPlaylists?.();
    }

    async loadNetworkDrives(): Promise<void> {
        await this.app.components.navigation?.loadNetworkDrives?.();
    }

    updateNavigationPlaylistInfo(playlist: Playlist): void {
        this.app.components.navigation?.updatePlaylistInfo?.(playlist);
    }

    updateStatisticsButtonVisibility(enabled: boolean): void {
        this.app.components.navigation?.updateStatisticsButtonVisibility?.(enabled);
    }

    updateRecentPlayButtonVisibility(enabled: boolean): void {
        this.app.components.navigation?.updateRecentPlayButtonVisibility?.(enabled);
    }

    updateArtistsPageButtonVisibility(enabled: boolean): void {
        this.app.components.navigation?.updateArtistsPageButtonVisibility?.(enabled);
    }

    updateAlbumsPageButtonVisibility(enabled: boolean): void {
        this.app.components.navigation?.updateAlbumsPageButtonVisibility?.(enabled);
    }

    navigateToView(view: string): void {
        this.app.components.navigation?.navigateToView?.(view);
    }

    focusSearchInput(): void {
        this.app.components.search?.focusInput();
    }
}
