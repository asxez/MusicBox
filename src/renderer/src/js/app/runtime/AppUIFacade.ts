import type {PlayMode} from '@api/types/playback';
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppComponentPort, ConfirmOptions, PlayerLike} from './AppRuntimeTypes';

type TrackPredicate = (track: Track, index: number) => boolean;

export class AppUIFacade {
    constructor(private readonly app: AppComponentPort) {}

    hasQueue(): boolean {
        return Boolean(this.app.components.playlist);
    }

    getQueueTracks(): Track[] {
        return this.app.components.playlist?.tracks ?? [];
    }

    isQueueEmpty(): boolean {
        return this.getQueueTracks().length === 0;
    }

    getQueueCurrentIndex(): number {
        return this.app.components.playlist?.currentTrackIndex ?? -1;
    }

    syncQueueTracks(tracks: Track[], currentIndex = 0): void {
        this.app.components.playlist?.setTracks(tracks, currentIndex);
    }

    setQueueCurrentTrack(index: number): void {
        this.app.components.playlist?.setCurrentTrack(index);
    }

    addQueueTrack(track: Track): number {
        return this.app.components.playlist?.addTrack(track) ?? -1;
    }

    removeQueueTrack(index: number): void {
        this.app.components.playlist?.removeTrack(index);
    }

    renderQueue(): void {
        this.app.components.playlist?.render();
    }

    toggleQueue(): void {
        this.app.components.playlist?.toggle();
    }

    findQueueIndex(predicate: TrackPredicate): number {
        return this.getQueueTracks().findIndex(predicate);
    }

    updateQueuedTrack(filePath: string, updatedData: Partial<Track>): boolean {
        const queuedTrack = this.getQueueTracks().find((track) => track.filePath === filePath);
        if (!queuedTrack) {
            return false;
        }

        Object.assign(queuedTrack, updatedData);
        this.renderQueue();
        return true;
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.app.components.player?.updatePlayModeDisplay(mode);
    }

    getActivePlayer(): PlayerLike | null {
        return this.app.components.player ?? null;
    }

    async updatePlayerTrackInfo(track: Track): Promise<void> {
        await this.app.components.player?.updateTrackInfo(track);
    }

    async updatePlayerUI(): Promise<void> {
        await this.app.components.player?.updateUI();
    }

    getPlayerVolume(): number | null {
        return this.app.components.player?.volume ?? null;
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        await this.app.components.player?.updateDesktopLyricsButtonVisibility(enabled);
    }

    isLyricsVisible(): boolean {
        return Boolean(this.app.components.lyrics?.isVisible);
    }

    async showLyricsForTrack(track: Track | null): Promise<void> {
        if (this.isLyricsVisible()) {
            await this.app.components.lyrics?.show(track);
        }
    }

    async toggleLyricsForTrack(track: Track | null): Promise<void> {
        await this.app.components.lyrics?.toggle(track);
    }

    async toggleLyricsPanel(track: Track | null): Promise<void> {
        const lyrics = this.app.components.lyrics;
        if (!lyrics) {
            return;
        }

        if (lyrics.isVisible) {
            lyrics.hide();
            return;
        }

        if (track) {
            await lyrics.show(track);
        }
    }

    exitLyricsPanel(): void {
        const lyrics = this.app.components.lyrics;
        if (!lyrics?.isVisible) {
            return;
        }

        if (lyrics.isFullscreen) {
            lyrics.exitFullscreen();
        } else {
            lyrics.hide();
        }
    }

    toggleLyricsFullscreen(requireVisible = true): void {
        const lyrics = this.app.components.lyrics;
        if (lyrics && (!requireVisible || lyrics.isVisible)) {
            lyrics.toggleFullscreen();
        }
    }

    updateLyricsProgress(position: number, duration: number): void {
        if (this.isLyricsVisible()) {
            this.app.components.lyrics?.updateProgress(position, duration);
        }
    }

    updateLyricsPlayButton(): void {
        if (this.isLyricsVisible()) {
            this.app.components.lyrics?.updatePlayButton();
        }
    }

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

    async toggleSettings(): Promise<void> {
        await this.app.components.settings?.toggle();
    }

    switchSettingsSection(sectionName: string): void {
        this.app.components.settings?.switchToSection(sectionName);
    }

    showCreatePlaylistDialog(track?: Track): void {
        this.app.components.createPlaylistDialog?.show(track);
    }

    async showAddToPlaylistDialog(track: Track): Promise<void> {
        await this.app.components.addToPlaylistDialog?.show(track);
    }

    showRenamePlaylistDialog(playlist: Playlist): void {
        this.app.components.renamePlaylistDialog?.show(playlist);
    }

    async showMusicLibrarySelectionDialog(playlist: Playlist): Promise<void> {
        await this.app.components.musicLibrarySelectionDialog?.show(playlist);
    }

    async showEditTrackInfoDialog(track: Track): Promise<void> {
        await this.app.components.editTrackInfoDialog?.show(track);
    }

    async confirm(options: ConfirmOptions): Promise<boolean> {
        return await this.app.components.confirmDialog.show(options);
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

    showUpdateModal(): void {
        this.app.components.updateModal?.show();
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
        document.querySelectorAll('.sidebar-link, .playlist-sidebar-item, .network-drive-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (type === 'playlist' && id) {
            document.querySelector(`[data-playlist-id="${id}"]`)?.classList.add('active');
            return;
        }

        if (type === 'network-drive' && id) {
            document.querySelector(`[data-drive-id="${id}"]`)?.classList.add('active');
            return;
        }

        document.querySelector(`[data-view="${type}"]`)?.classList.add('active');
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
        document.getElementById('search-input')?.focus();
    }
}
