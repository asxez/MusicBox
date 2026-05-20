/**
 * MusicBox renderer entry.
 */

import '@utils/index.js';
import '@api/api';

import '@utils/md5';
import '@utils/shortcuts/ShortcutConfig';
import '@utils/shortcuts/ShortcutRecorder';

import '@ui/base/Component';

import '@extensions/core/Lifecycle.js';
import '@extensions/core/Event.js';
import '@extensions/core/Instantiation.js';
import '@extensions/core/ExtensionsRegistry.js';
import '@extensions/core/ExtensionActivator.js';
import '@extensions/core/ExtensionService.js';
import '@extensions/core/index.js';

import '@extensions/api/index.js';

import '@ui/pages/ArtistsPage';
import '@ui/pages/AlbumsPage';
import '@ui/pages/HomePage';
import '@ui/pages/NetworkDriveDetailPage';
import '@ui/pages/PlaylistDetailPage';
import '@ui/pages/RecentPage';
import '@ui/pages/Settings';
import '@ui/pages/StatisticsPage';
import '@ui/widgets/ContextMenu';
import '@ui/widgets/EqualizerComponent';
import '@ui/widgets/Lyrics';
import '@ui/widgets/Navigation';
import '@ui/widgets/Player';
import '@ui/widgets/Playlist';
import '@ui/widgets/Search';
import '@ui/widgets/TrackList';
import '@ui/modals/NetworkDiskModal';
import '@ui/modals/PluginManagerModal';
import '@ui/modals/UpdateModal';

import '@ui/dialogs/AddToPlaylistDialog';
import '@ui/dialogs/CreatePlaylistDialog';
import '@ui/dialogs/EditTrackInfoDialog';
import '@ui/dialogs/MusicLibrarySelectionDialog';
import '@ui/dialogs/RenamePlaylistDialog';

import './app';

console.log('✅ MusicBox 应用已通过 Vite 加载完成');
