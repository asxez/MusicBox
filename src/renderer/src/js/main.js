/**
 * MusicBox 主入口文件
 * Vite 构建系统入口
 */

// ============================================
// 1. 导入工具函数和 API
// ============================================
import './utils.js';
import './api.js';

// ============================================
// 2. 导入基础工具
// ============================================
import './md5.js';
import './shortcut-config.js';
import './shortcut-recorder.js';

// ============================================
// 3. 导入基础组件
// ============================================
import './components/base/Component.js';

// ============================================
// 4. 导入插件系统核心（必须按顺序加载）
// ============================================
import './extensions/core/Lifecycle.js';
import './extensions/core/Event.js';
import './extensions/core/Instantiation.js';
import './extensions/core/ExtensionsRegistry.js';
import './extensions/core/ExtensionActivator.js';
import './extensions/core/ExtensionService.js';
import './extensions/core/index.js';

// ============================================
// 5. 导入扩展 API
// ============================================
import './extensions/api/index.js';

// ============================================
// 6. 导入页面组件
// ============================================
import './components/component/ArtistsPage.js';
import './components/component/AlbumsPage.js';
import './components/component/ContextMenu.js';
import './components/component/EqualizerComponent.js';
import './components/component/HomePage.js';
import './components/component/Lyrics.js';
import './components/component/Navigation.js';
import './components/component/NetworkDiskModal.js';
import './components/component/NetworkDriveDetailPage.js';
import './components/component/Player.js';
import './components/component/Playlist.js';
import './components/component/PlaylistDetailPage.js';
import './components/component/PluginManagerModal.js';
import './components/component/RecentPage.js';
import './components/component/Search.js';
import './components/component/Settings.js';
import './components/component/StatisticsPage.js';
import './components/component/TrackList.js';
import './components/component/UpdateModal.js';

// ============================================
// 7. 导入对话框组件
// ============================================
import './components/dialogs/AddToPlaylistDialog.js';
import './components/dialogs/CreatePlaylistDialog.js';
import './components/dialogs/EditTrackInfoDialog.js';
import './components/dialogs/MusicLibrarySelectionDialog.js';
import './components/dialogs/RenamePlaylistDialog.js';

// ============================================
// 8. 导入组件索引
// ============================================
import './components/index.js';

// ============================================
// 9. 导入主应用
// ============================================
import './app.js';

console.log('✅ MusicBox 应用已通过 Vite 加载完成');
