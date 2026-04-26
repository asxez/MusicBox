/**
 * MusicBox 主入口文件
 * Vite 构建系统入口
 */

// ============================================
// 1. 导入工具函数和 API
// ============================================
import '@utils/index.js';
import '@api/api.js';

// ============================================
// 2. 导入基础工具
// ============================================
import '@utils/md5';
import '@utils/shortcuts/ShortcutConfig';
import '@utils/shortcuts/ShortcutRecorder';

// ============================================
// 3. 导入基础组件
// ============================================
import '@components/base/Component';

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
// 6. 导入页面组件
// ============================================
import '@components/component/ArtistsPage';
import '@components/component/AlbumsPage';
import '@components/component/ContextMenu';
import '@components/component/EqualizerComponent';
import '@components/component/HomePage';
import '@components/component/Lyrics';
import '@components/component/Navigation';
import '@components/component/NetworkDiskModal';
import '@components/component/NetworkDriveDetailPage';
import '@components/component/Player';
import '@components/component/Playlist';
import '@components/component/PlaylistDetailPage';
import '@components/component/PluginManagerModal';
import '@components/component/RecentPage';
import '@components/component/Search';
import '@components/component/Settings.js';
import '@components/component/StatisticsPage';
import '@components/component/TrackList';
import '@components/component/UpdateModal';

// ============================================
// 7. 导入对话框组件
// ============================================
import '@components/dialogs/AddToPlaylistDialog';
import '@components/dialogs/CreatePlaylistDialog';
import '@components/dialogs/EditTrackInfoDialog';
import '@components/dialogs/MusicLibrarySelectionDialog';
import '@components/dialogs/RenamePlaylistDialog';

// ============================================
// 8. 导入组件索引
// ============================================
import '@components/index';

// ============================================
// 9. 导入主应用
// ============================================
import './app';

console.log('✅ MusicBox 应用已通过 Vite 加载完成');
