/**
 * MusicBox 主入口文件
 * Vite 构建系统入口
 */

// ============================================
// 1. 导入工具函数和 API
// ============================================
import '@utils/index.js';
import '@api/api';

// ============================================
// 2. 导入基础工具
// ============================================
import '@utils/md5';
import '@utils/shortcuts/ShortcutConfig';
import '@utils/shortcuts/ShortcutRecorder';

// ============================================
// 3. 导入基础组件
// ============================================
import '@ui/base/Component';

// ============================================
// 4. 导入插件系统核心（必须按顺序加载）
// ============================================
import '@extensions/core/Lifecycle.js';
import '@extensions/core/Event.js';
import '@extensions/core/Instantiation.js';
import '@extensions/core/ExtensionsRegistry.js';
import '@extensions/core/ExtensionActivator.js';
import '@extensions/core/ExtensionService.js';
import '@extensions/core/index.js';

// ============================================
// 5. 导入扩展 API
// ============================================
import '@extensions/api/index.js';

// ============================================
// 6. 导入 UI 页面和组件
// ============================================
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

// ============================================
// 7. 导入对话框组件
// ============================================
import '@ui/dialogs/AddToPlaylistDialog';
import '@ui/dialogs/CreatePlaylistDialog';
import '@ui/dialogs/EditTrackInfoDialog';
import '@ui/dialogs/MusicLibrarySelectionDialog';
import '@ui/dialogs/RenamePlaylistDialog';

// ============================================
// 9. 导入主应用
// ============================================
import './app';

console.log('✅ MusicBox 应用已通过 Vite 加载完成');
