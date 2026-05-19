import type {PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';
import type {AlbumsPage} from '@ui/pages/AlbumsPage';
import type {ArtistsPage} from '@ui/pages/ArtistsPage';
import type {HomePage} from '@ui/pages/HomePage';
import type {NetworkDriveDetailPage} from '@ui/pages/NetworkDriveDetailPage';
import type {PlaylistDetailPage} from '@ui/pages/PlaylistDetailPage';
import type {RecentPage} from '@ui/pages/RecentPage';
import type {Settings} from '@ui/pages/Settings';
import type {StatisticsPage} from '@ui/pages/StatisticsPage';
import type {AddToPlaylistDialog} from '@ui/dialogs/AddToPlaylistDialog';
import type {ConfirmDialog} from '@ui/dialogs/ConfirmDialog';
import type {CreatePlaylistDialog} from '@ui/dialogs/CreatePlaylistDialog';
import type {EditTrackInfoDialog} from '@ui/dialogs/EditTrackInfoDialog';
import type {MusicLibrarySelectionDialog} from '@ui/dialogs/MusicLibrarySelectionDialog';
import type {RenamePlaylistDialog} from '@ui/dialogs/RenamePlaylistDialog';
import type {NetworkDiskModal} from '@ui/modals/NetworkDiskModal';
import type {PluginManagerModal} from '@ui/modals/PluginManagerModal';
import type {UpdateModal} from '@ui/modals/UpdateModal';
import type {ContextMenu} from '@ui/widgets/ContextMenu';
import type {EqualizerComponent} from '@ui/widgets/EqualizerComponent';
import type {Lyrics} from '@ui/widgets/Lyrics';
import type {Navigation} from '@ui/widgets/Navigation';
import type ParametricEqualizerComponent from '@ui/widgets/ParametricEqualizerComponent';
import type {Player} from '@ui/widgets/Player';
import type {Playlist as QueuePlaylist} from '@ui/widgets/Playlist';
import type {Search} from '@ui/widgets/Search';
import type {TrackList} from '@ui/widgets/TrackList';

export interface ComponentRegistryMap {
    player: Player;
    search: Search;
    navigation: Navigation & Record<string, any>;
    trackList: TrackList;
    playlist: QueuePlaylist;
    contextMenu: ContextMenu;
    settings: Settings;
    lyrics: Lyrics;
    equalizer: EqualizerComponent;
    parametricEqualizer: ParametricEqualizerComponent;
    confirmDialog: ConfirmDialog;
    createPlaylistDialog: CreatePlaylistDialog;
    addToPlaylistDialog: AddToPlaylistDialog;
    renamePlaylistDialog: RenamePlaylistDialog;
    musicLibrarySelectionDialog: MusicLibrarySelectionDialog;
    editTrackInfoDialog: EditTrackInfoDialog;
    playlistDetailPage: PlaylistDetailPage;
    networkDriveDetailPage: NetworkDriveDetailPage;
    updateModal: UpdateModal;
    pluginManagerModal: PluginManagerModal;
    homePage: HomePage;
    recentPage: RecentPage | null;
    artistsPage: ArtistsPage | null;
    albumsPage: AlbumsPage | null;
    statisticsPage: StatisticsPage | null;
    networkDiskModal: NetworkDiskModal | null;
}

export type ComponentMap = ComponentRegistryMap & Record<string, any>;

export interface PlayerLike {
    togglePlayPause?: () => Promise<void> | void;
    updatePlayModeDisplay?: (mode: PlayMode) => void;
    getVolume?: () => number;
}

export interface LyricsLike {
    isVisible?: boolean;
    isFullscreen?: boolean;
    show?: (track: Track | null) => Promise<void> | void;
    hide?: () => void;
    updateProgress?: (position: number, duration: number) => void;
    updatePlayButton?: (isPlaying: boolean) => void;
    exitFullscreen?: () => void;
    toggleFullscreen?: () => void;
}
