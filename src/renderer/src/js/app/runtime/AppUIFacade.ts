import type {PlayMode} from '@api/types/playback';
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppComponentPort} from './AppRuntimePorts';
import type {PlayerLike} from './components/ComponentTypes';
import type {ConfirmOptions} from '@js/shared/types/AppContracts';
import {ContentUIFacade} from './ui/ContentUIFacade';
import {DialogUIFacade} from './ui/DialogUIFacade';
import {PlaybackUIFacade} from './ui/PlaybackUIFacade';
import {QueueUIFacade} from './ui/QueueUIFacade';

export class AppUIFacade {
    private readonly content: ContentUIFacade;
    private readonly dialogs: DialogUIFacade;
    private readonly playback: PlaybackUIFacade;
    private readonly queue: QueueUIFacade;

    constructor(app: AppComponentPort) {
        this.content = new ContentUIFacade(app);
        this.dialogs = new DialogUIFacade(app);
        this.playback = new PlaybackUIFacade(app);
        this.queue = new QueueUIFacade(app);
    }

    hasQueue(): boolean {
        return this.queue.hasQueue();
    }

    getQueueTracks(): Track[] {
        return this.queue.getQueueTracks();
    }

    isQueueEmpty(): boolean {
        return this.queue.isQueueEmpty();
    }

    getQueueCurrentIndex(): number {
        return this.queue.getQueueCurrentIndex();
    }

    syncQueueTracks(tracks: Track[], currentIndex = 0): void {
        this.queue.syncQueueTracks(tracks, currentIndex);
    }

    setQueueCurrentTrack(index: number): void {
        this.queue.setQueueCurrentTrack(index);
    }

    addQueueTrack(track: Track): number {
        return this.queue.addQueueTrack(track);
    }

    removeQueueTrack(index: number): void {
        this.queue.removeQueueTrack(index);
    }

    renderQueue(): void {
        this.queue.renderQueue();
    }

    toggleQueue(): void {
        this.queue.toggleQueue();
    }

    findQueueIndex(predicate: (track: Track, index: number) => boolean): number {
        return this.queue.findQueueIndex(predicate);
    }

    updateQueuedTrack(filePath: string, updatedData: Partial<Track>): boolean {
        return this.queue.updateQueuedTrack(filePath, updatedData);
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.playback.updatePlayModeDisplay(mode);
    }

    getActivePlayer(): PlayerLike | null {
        return this.playback.getActivePlayer();
    }

    async updatePlayerTrackInfo(track: Track): Promise<void> {
        await this.playback.updatePlayerTrackInfo(track);
    }

    async updatePlayerUI(): Promise<void> {
        await this.playback.updatePlayerUI();
    }

    getPlayerVolume(): number | null {
        return this.playback.getPlayerVolume();
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        await this.playback.updateDesktopLyricsButtonVisibility(enabled);
    }

    isLyricsVisible(): boolean {
        return this.playback.isLyricsVisible();
    }

    async showLyricsForTrack(track: Track | null): Promise<void> {
        await this.playback.showLyricsForTrack(track);
    }

    async toggleLyricsForTrack(track: Track | null): Promise<void> {
        await this.playback.toggleLyricsForTrack(track);
    }

    async toggleLyricsPanel(track: Track | null): Promise<void> {
        await this.playback.toggleLyricsPanel(track);
    }

    exitLyricsPanel(): void {
        this.playback.exitLyricsPanel();
    }

    toggleLyricsFullscreen(requireVisible = true): void {
        this.playback.toggleLyricsFullscreen(requireVisible);
    }

    updateLyricsProgress(position: number, duration: number): void {
        this.playback.updateLyricsProgress(position, duration);
    }

    updateLyricsPlayButton(): void {
        this.playback.updateLyricsPlayButton();
    }

    setTrackListTracks(tracks: Track[]): void {
        this.content.setTrackListTracks(tracks);
    }

    showTrackList(): void {
        this.content.showTrackList();
    }

    hideTrackList(): void {
        this.content.hideTrackList();
    }

    clearTrackListSelection(): void {
        this.content.clearTrackListSelection();
    }

    showContextMenu(
        x: number,
        y: number,
        track: Track,
        index: number,
        selectedTracks?: Set<number>
    ): void {
        this.content.showContextMenu(x, y, track, index, selectedTracks);
    }

    async toggleSettings(): Promise<void> {
        await this.dialogs.toggleSettings();
    }

    switchSettingsSection(sectionName: string): void {
        this.dialogs.switchSettingsSection(sectionName);
    }

    showCreatePlaylistDialog(track?: Track): void {
        this.dialogs.showCreatePlaylistDialog(track);
    }

    async showAddToPlaylistDialog(track: Track): Promise<void> {
        await this.dialogs.showAddToPlaylistDialog(track);
    }

    showRenamePlaylistDialog(playlist: Playlist): void {
        this.dialogs.showRenamePlaylistDialog(playlist);
    }

    async showMusicLibrarySelectionDialog(playlist: Playlist): Promise<void> {
        await this.dialogs.showMusicLibrarySelectionDialog(playlist);
    }

    async showEditTrackInfoDialog(track: Track): Promise<void> {
        await this.dialogs.showEditTrackInfoDialog(track);
    }

    async confirm(options: ConfirmOptions): Promise<boolean> {
        return await this.dialogs.confirm(options);
    }

    async showPlaylistDetail(playlist: Playlist): Promise<void> {
        await this.content.showPlaylistDetail(playlist);
    }

    async showNetworkDriveDetail(drive: unknown): Promise<void> {
        await this.content.showNetworkDriveDetail(drive);
    }

    async removeTrackFromPlaylistDetail(track: Track, index: number): Promise<boolean> {
        return await this.content.removeTrackFromPlaylistDetail(track, index);
    }

    async removeSelectedTracksFromPlaylistDetail(): Promise<boolean> {
        return await this.content.removeSelectedTracksFromPlaylistDetail();
    }

    isPlaylistDetailVisible(): boolean {
        return this.content.isPlaylistDetailVisible();
    }

    updatePlaylistDetailTrack(filePath: string, updatedData: Partial<Track>): boolean {
        return this.content.updatePlaylistDetailTrack(filePath, updatedData);
    }

    async reloadPlaylistDetailTracks(): Promise<void> {
        await this.content.reloadPlaylistDetailTracks();
    }

    showUpdateModal(): void {
        this.dialogs.showUpdateModal();
    }

    showNetworkDriveModal(): boolean {
        return this.dialogs.showNetworkDriveModal();
    }

    async showPluginManager(): Promise<boolean> {
        return await this.dialogs.showPluginManager();
    }

    async showHomePage(): Promise<void> {
        await this.content.showHomePage();
    }

    async showRecentPage(): Promise<void> {
        await this.content.showRecentPage();
    }

    async showArtistsPage(): Promise<void> {
        await this.content.showArtistsPage();
    }

    async showAlbumsPage(): Promise<void> {
        await this.content.showAlbumsPage();
    }

    async showStatisticsPage(): Promise<void> {
        await this.content.showStatisticsPage();
    }

    hideAllPages(): void {
        this.content.hideAllPages();
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        this.content.updateSidebarSelection(type, id);
    }

    async refreshNavigationPlaylists(): Promise<void> {
        await this.content.refreshNavigationPlaylists();
    }

    async loadNetworkDrives(): Promise<void> {
        await this.content.loadNetworkDrives();
    }

    updateNavigationPlaylistInfo(playlist: Playlist): void {
        this.content.updateNavigationPlaylistInfo(playlist);
    }

    updateStatisticsButtonVisibility(enabled: boolean): void {
        this.content.updateStatisticsButtonVisibility(enabled);
    }

    updateRecentPlayButtonVisibility(enabled: boolean): void {
        this.content.updateRecentPlayButtonVisibility(enabled);
    }

    updateArtistsPageButtonVisibility(enabled: boolean): void {
        this.content.updateArtistsPageButtonVisibility(enabled);
    }

    updateAlbumsPageButtonVisibility(enabled: boolean): void {
        this.content.updateAlbumsPageButtonVisibility(enabled);
    }

    navigateToView(view: string): void {
        this.content.navigateToView(view);
    }

    focusSearchInput(): void {
        this.content.focusSearchInput();
    }
}
