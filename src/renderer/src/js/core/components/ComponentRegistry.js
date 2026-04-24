import {AlbumsPage} from "@components/component/AlbumsPage";
import {ArtistsPage} from "@components/component/ArtistsPage";
import {ContextMenu} from "@components/component/ContextMenu";
import {EqualizerComponent} from "@components/component/EqualizerComponent";
import ParametricEqualizerComponent from "@components/component/ParametricEqualizerComponent";
import {HomePage} from "@components/component/HomePage";
import {Lyrics} from "@components/component/Lyrics";
import {Navigation} from "@components/component/Navigation";
import {NetworkDiskModal} from "@components/component/NetworkDiskModal";
import {NetworkDriveDetailPage} from "@components/component/NetworkDriveDetailPage";
import {Player} from '@components/component/Player';
import {Playlist} from "@components/component/Playlist";
import {PlaylistDetailPage} from "@components/component/PlaylistDetailPage";
import {PluginManagerModal} from "@components/component/PluginManagerModal";
import {RecentPage} from "@components/component/RecentPage";
import {Search} from "@components/component/Search";
import {Settings} from "@components/component/Settings";
import {StatisticsPage} from "@components/component/StatisticsPage";
import {TrackList} from "@components/component/TrackList";
import {UpdateModal} from "@components/component/UpdateModal";

import {AddToPlaylistDialog} from "@components/dialogs/AddToPlaylistDialog";
import {ConfirmDialog} from "@components/dialogs/ConfirmDialog";
import {CreatePlaylistDialog} from "@components/dialogs/CreatePlaylistDialog";
import {EditTrackInfoDialog} from "@components/dialogs/EditTrackInfoDialog";
import {MusicLibrarySelectionDialog} from "@components/dialogs/MusicLibrarySelectionDialog";
import {RenamePlaylistDialog} from "@components/dialogs/RenamePlaylistDialog";

import {cacheManager} from "@services/CacheManager";

export class ComponentRegistry {
    constructor({components, setupComponentEvents}) {
        this.components = components;
        this.setupComponentEvents = setupComponentEvents;
    }

    initializeComponents() {
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

        window.settings = this.components.settings;

        this.components.updateModal = new UpdateModal();
        window.updateModal = this.components.updateModal;

        this.components.networkDiskModal = null;
        this.components.pluginManagerModal = new PluginManagerModal();
        this.components.homePage = new HomePage('#content-area');

        this.initializePageComponentsOnDemand();
    }

    initializePageComponentsOnDemand() {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};

        const recentPlayEnabled = settings.hasOwnProperty('recentPlay') ? settings.recentPlay : true;
        if (recentPlayEnabled) {
            this.components.recentPage = new RecentPage('#content-area');
        } else {
            this.components.recentPage = null;
        }

        const artistsPageEnabled = settings.hasOwnProperty('artistsPage') ? settings.artistsPage : true;
        if (artistsPageEnabled) {
            this.components.artistsPage = new ArtistsPage('#content-area');
        } else {
            this.components.artistsPage = null;
        }

        const albumsPageEnabled = settings.hasOwnProperty('albumsPage') ? settings.albumsPage : true;
        if (albumsPageEnabled) {
            this.components.albumsPage = new AlbumsPage('#content-area');
        } else {
            this.components.albumsPage = null;
        }

        const statisticsEnabled = settings.hasOwnProperty('statistics') ? settings.statistics : true;
        if (statisticsEnabled) {
            this.components.statisticsPage = new StatisticsPage('#content-area');
        } else {
            this.components.statisticsPage = null;
        }

        const networkDriveEnabled = settings.hasOwnProperty('networkDriveEnabled') ? settings.networkDriveEnabled : false;
        if (networkDriveEnabled) {
            this.initializeComponent('networkDiskModal');
        } else {
            this.components.networkDiskModal = null;
        }
    }

    initializeComponent(componentName) {
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

    destroyComponent(componentName) {
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
}
