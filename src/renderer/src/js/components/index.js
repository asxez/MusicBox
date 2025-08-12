/**
 * 组件索引文件
 * 统一导入和导出所有组件，方便其他模块使用
 */


/**
 * 组件加载顺序说明：
 * 
 * 1. 基础组件 (utils.js 中的 EventEmitter 和 components/base/Component.js)
 * 2. 页面组件 (components/pages/*.js)
 * 3. 对话框组件 (components/dialogs/*.js)
 * 
 * 所有组件都会通过 HTML 中的 script 标签按顺序加载，
 * 确保依赖关系正确。
 */

// 组件列表
const COMPONENTS = {
    // 基础组件
    base: [
        'EventEmitter', // utils.js
        'Component'     // base/Component.js
    ],
    
    // 页面组件
    component: [
        'ArtistsPage',         // 艺术家页组件
        'AlbumsPage',          // 专辑页组件
        'ContextMenu',         // 菜单组件
        'EqualizerComponent',  // 均衡器组件
        'HomePage',            // 首页组件
        'Lyrics',              // 歌词页组件
        'Navigation',          // 侧边导航栏组件
        'Player',              // 播放器控制台组件
        'Playlist',            // 播放列表组件
        'PlaylistDetailPage',  // 歌单页组件
        'PluginManagerModal',  // 插件管理器模态框组件
        'RecentPage',          // 最近播放页组件
        'Search',              // 搜索组件
        'Settings',            // 设置组件
        'StatisticsPage',      // 统计页组件
        'TrackList',           // 我的音乐页组件
    ],

    // 对话框组件
    dialogs: [
        'AddToPlaylistDialog',         // 添加到歌单对话框
        'CreatePlaylistDialog',        // 创建歌单对话框
        'EditTrackInfoDialog',         // 编辑歌曲信息对话框
        'MusicLibrarySelectionDialog', // 音乐库选择对话框
        'RenamePlaylistDialog',        // 重命名歌单对话框组件
    ]
};

// 导出组件列表供调试使用
if (typeof window !== 'undefined') {
    window.MUSICBOX_COMPONENTS = COMPONENTS;
    console.log('📦 MusicBox 组件列表:', COMPONENTS);
}

/**
 * 组件初始化检查函数
 * 检查所有必需的组件是否已正确加载
 */
function checkComponentsLoaded() {
    const missing = [];
    
    // 检查基础组件
    if (typeof EventEmitter === 'undefined') {
        missing.push('EventEmitter');
    }
    if (typeof Component === 'undefined') {
        missing.push('Component');
    }
    
    // 检查页面组件
    const pageComponents = COMPONENTS.component;
    pageComponents.forEach(name => {
        if (typeof window['components']['component'][name] === 'undefined') {
            missing.push(name);
        }
    });

    // 检查对话框组件
    const dialogComponents = COMPONENTS.dialogs;
    dialogComponents.forEach(name => {
        if (typeof window['components']['dialogs'][name] === 'undefined') {
            missing.push(name);
        }
    });
    
    if (missing.length > 0) {
        console.error('❌ 以下组件未正确加载:', missing);
        return false;
    } else {
        console.log('✅ 所有组件已正确加载');
        return true;
    }
}

if (typeof window !== 'undefined') {
    window.checkComponentsLoaded = checkComponentsLoaded;
}

/**
 * 组件加载完成事件
 * 当所有组件都加载完成后触发
 */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const allLoaded = checkComponentsLoaded();
        if (allLoaded) {
            // 触发自定义事件，通知应用所有组件已加载完成
            const event = new CustomEvent('componentsLoaded', {
                detail: { components: COMPONENTS }
            });
            document.dispatchEvent(event);
            console.log('🎉 所有 MusicBox 组件加载完成');
        }
    }, 100);
});
