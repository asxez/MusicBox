import {AlbumsPage} from "@ui/pages/AlbumsPage";
import {ArtistsPage} from "@ui/pages/ArtistsPage";
import {HomePage} from "@ui/pages/HomePage";
import {NetworkDriveDetailPage} from "@ui/pages/NetworkDriveDetailPage";
import {PlaylistDetailPage} from "@ui/pages/PlaylistDetailPage";
import {RecentPage} from "@ui/pages/RecentPage";
import {Settings} from "@ui/pages/Settings";
import {StatisticsPage} from "@ui/pages/StatisticsPage";
import {ContextMenu} from "@ui/widgets/ContextMenu";
import {EqualizerComponent} from "@ui/widgets/EqualizerComponent";
import ParametricEqualizerComponent from "@ui/widgets/ParametricEqualizerComponent";
import {Lyrics} from "@ui/widgets/Lyrics";
import {Navigation} from "@ui/widgets/Navigation";
import {Player} from '@ui/widgets/Player';
import {Playlist} from "@ui/widgets/Playlist";
import {Search} from "@ui/widgets/Search";
import {TrackList} from "@ui/widgets/TrackList";
import {NetworkDiskModal} from "@ui/modals/NetworkDiskModal";
import {PluginManagerModal} from "@ui/modals/PluginManagerModal";
import {UpdateModal} from "@ui/modals/UpdateModal";

import {AddToPlaylistDialog} from "@ui/dialogs/AddToPlaylistDialog";
import {ConfirmDialog} from "@ui/dialogs/ConfirmDialog";
import {CreatePlaylistDialog} from "@ui/dialogs/CreatePlaylistDialog";
import {EditTrackInfoDialog} from "@ui/dialogs/EditTrackInfoDialog";
import {MusicLibrarySelectionDialog} from "@ui/dialogs/MusicLibrarySelectionDialog";
import {RenamePlaylistDialog} from "@ui/dialogs/RenamePlaylistDialog";

import {cacheManager} from "@js/shared/cache";
import type {ComponentMap} from "@js/app/runtime/components/ComponentTypes";

interface ComponentRegistryOptions {
    components: ComponentMap;
    setupComponentEvents: (componentName: string) => void;
}

type OnDemandComponentName =
    | 'recentPage'
    | 'artistsPage'
    | 'albumsPage'
    | 'statisticsPage'
    | 'networkDiskModal';

export class ComponentRegistry {
    private readonly components: ComponentMap;
    private readonly setupComponentEvents: (componentName: string) => void;

    constructor({components, setupComponentEvents}: ComponentRegistryOptions) {
        this.components = components;
        this.setupComponentEvents = setupComponentEvents;
    }

    initializeComponents(): void {
        this.components.player = new Player();
        this.components.search = new Search();
        this.components.navigation = new Navigation();
        this.components.trackList = new TrackList('#content-area');
        this.components.playlist = new Playlist(document.getElementById('playlist-panel'));
        this.components.contextMenu = new ContextMenu(document.getElementById('context-menu'));
        this.components.settings = new Settings(document.getElementById('settings-page'));
        this.components.lyrics = new Lyrics(document.getElementById('lyrics-page'));
        this.components.equalizer = new EqualizerComponent();
        this.components.parametricEqualizer = new ParametricEqualizerComponent();

        this.components.confirmDialog = new ConfirmDialog();
        this.components.createPlaylistDialog = new CreatePlaylistDialog();
        this.components.addToPlaylistDialog = new AddToPlaylistDialog();
        this.components.renamePlaylistDialog = new RenamePlaylistDialog();
        this.components.musicLibrarySelectionDialog = new MusicLibrarySelectionDialog();
        this.components.editTrackInfoDialog = new EditTrackInfoDialog();

        this.components.playlistDetailPage = new PlaylistDetailPage('#content-area');
        this.components.networkDriveDetailPage = new NetworkDriveDetailPage('#content-area');

        this.components.updateModal = new UpdateModal();

        this.components.networkDiskModal = null;
        this.components.pluginManagerModal = new PluginManagerModal();
        this.components.homePage = new HomePage('#content-area');

        this.initializePageComponentsOnDemand();
    }

    initializePageComponentsOnDemand(): void {
        const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as Record<string, unknown>;
        const getSetting = (key: string, fallback: boolean): unknown => (
            Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback
        );

        const recentPlayEnabled = getSetting('recentPlay', true);
        if (recentPlayEnabled) {
            this.components.recentPage = new RecentPage('#content-area');
        } else {
            this.components.recentPage = null;
        }

        const artistsPageEnabled = getSetting('artistsPage', true);
        if (artistsPageEnabled) {
            this.components.artistsPage = new ArtistsPage('#content-area');
        } else {
            this.components.artistsPage = null;
        }

        const albumsPageEnabled = getSetting('albumsPage', true);
        if (albumsPageEnabled) {
            this.components.albumsPage = new AlbumsPage('#content-area');
        } else {
            this.components.albumsPage = null;
        }

        const statisticsEnabled = getSetting('statistics', true);
        if (statisticsEnabled) {
            this.components.statisticsPage = new StatisticsPage('#content-area');
        } else {
            this.components.statisticsPage = null;
        }

        const networkDriveEnabled = getSetting('networkDriveEnabled', false);
        if (networkDriveEnabled) {
            this.initializeComponent('networkDiskModal');
        } else {
            this.components.networkDiskModal = null;
        }
    }

    initializeComponent(componentName: OnDemandComponentName | string): void {
        switch (componentName) {
            case 'recentPage':
                if (!this.components.recentPage) {
                    this.components.recentPage = new RecentPage('#content-area');
                    this.setupComponentEvents('recentPage');
                }
                break;
            case 'artistsPage':
                if (!this.components.artistsPage) {
                    this.components.artistsPage = new ArtistsPage('#content-area');
                    this.setupComponentEvents('artistsPage');
                }
                break;
            case 'albumsPage':
                if (!this.components.albumsPage) {
                    this.components.albumsPage = new AlbumsPage('#content-area');
                    this.setupComponentEvents('albumsPage');
                }
                break;
            case 'statisticsPage':
                if (!this.components.statisticsPage) {
                    this.components.statisticsPage = new StatisticsPage('#content-area');
                    this.setupComponentEvents('statisticsPage');
                }
                break;
            case 'networkDiskModal':
                if (!this.components.networkDiskModal) {
                    this.components.networkDiskModal = new NetworkDiskModal();
                    this.setupComponentEvents('networkDiskModal');
                }
                break;
            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    destroyComponent(componentName: OnDemandComponentName | string): void {
        switch (componentName) {
            case 'recentPage':
                if (this.components.recentPage) {
                    this.components.recentPage.destroy();
                    this.components.recentPage = null;
                }
                break;
            case 'artistsPage':
                if (this.components.artistsPage) {
                    this.components.artistsPage.destroy();
                    this.components.artistsPage = null;
                }
                break;
            case 'albumsPage':
                if (this.components.albumsPage) {
                    this.components.albumsPage.destroy();
                    this.components.albumsPage = null;
                }
                break;
            case 'statisticsPage':
                if (this.components.statisticsPage) {
                    this.components.statisticsPage.destroy();
                    this.components.statisticsPage = null;
                }
                break;
            case 'networkDiskModal':
                if (this.components.networkDiskModal) {
                    this.components.networkDiskModal.hide();
                    this.components.networkDiskModal.destroy();
                    this.components.networkDiskModal = null;
                }
                break;
            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    destroyAllComponents(): void {
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                try {
                    component.destroy();
                } catch (error) {
                    console.warn('Failed to destroy component:', error);
                }
            }
        });

        Object.keys(this.components).forEach((key: string) => {
            delete this.components[key];
        });
    }
}
