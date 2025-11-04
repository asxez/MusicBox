#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {minify} = require('terser');

const srcDir = path.join(__dirname, '..', 'src');
const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, {recursive: true});
}

// Create subdirectories
const subdirs = ['js', 'styles'];
subdirs.forEach(dir => {
    const dirPath = path.join(publicDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
});

// Recursively collect all JavaScript files from a directory
function collectJSFiles(dir, basePath = '') {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const entries = fs.readdirSync(dir, {withFileTypes: true});

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        if (entry.isDirectory()) {
            // Recursively collect files from subdirectories
            files.push(...collectJSFiles(fullPath, relativePath));
        } else if (entry.name.endsWith('.js')) {
            files.push({
                name: entry.name,
                path: fullPath,
                relativePath: relativePath
            });
        }
    }

    return files;
}

// Bundle and minify JavaScript
async function bundleJS() {
    const jsDir = path.join(srcDir, 'js');

    if (!fs.existsSync(jsDir)) {
        console.error('✗ JavaScript source directory not found');
        return;
    }

    let bundledCode = '';

    // Define the loading order for components
    const componentLoadOrder = [
        'md5.js',
        'shortcut-config.js',
        'shortcut-recorder.js',

        // 1. 基础组件
        'components/base/Component.js',

        // 2. 新插件系统核心基础设施（必须最先加载）
        'plugin-system/core/Lifecycle.js',
        'plugin-system/core/Event.js',
        'plugin-system/core/Instantiation.js',
        'plugin-system/core/ExtensionsRegistry.js',
        'plugin-system/core/ExtensionActivator.js',
        'plugin-system/core/ExtensionService.js',
        'plugin-system/core/index.js',

        // 3. 扩展 API
        'plugin-system/api/ExtensionAPI.js',

        // 4. 页面组件
        'components/component/ArtistsPage.js',
        'components/component/AlbumsPage.js',
        'components/component/ContextMenu.js',
        'components/component/EqualizerComponent.js',
        'components/component/HomePage.js',
        'components/component/Lyrics.js',
        'components/component/Navigation.js',
        'components/component/NetworkDiskModal.js',
        'components/component/Player.js',
        'components/component/Playlist.js',
        'components/component/PlaylistDetailPage.js',
        'components/component/PluginManagerModal.js',
        'components/component/RecentPage.js',
        'components/component/Search.js',
        'components/component/Settings.js',
        'components/component/StatisticsPage.js',
        'components/component/TrackList.js',
        'components/component/UpdateModal.js',

        // 4. 对话框组件
        'components/dialogs/AddToPlaylistDialog.js',
        'components/dialogs/CreatePlaylistDialog.js',
        'components/dialogs/EditTrackInfoDialog.js',
        'components/dialogs/MusicLibrarySelectionDialog.js',
        'components/dialogs/RenamePlaylistDialog.js',

        // 5. 组件索引
        'components/index.js',
    ];

    // Main files in specific order
    const mainFileOrder = ['utils.js', 'api.js'];

    // Files to exclude from bundling (loaded separately)
    const excludeFiles = [
        'web-audio-engine.js',
        'cache-manager.js',
        'local-lyrics-manager.js',
        'local-cover-manager.js',
        'desktop-lyrics.js',
        'embedded-lyrics-manager.js',
        'embedded-cover-manager.js',
        'url-validator.js',
        'cover-update-manager.js',
    ];

    const excludeDirs = [
        'plugin-system/examples',
        'plugin-system/docs',
    ];

    // 需要单独复制的插件系统文件（不打包到 bundle.js）
    const pluginSystemSeparateFiles = [
        'plugin-system/examples/hello-world-extension/extension.js',
        'plugin-system/examples/hello-world-extension/manifest.json',
    ];

    // Collect all JavaScript files
    const allFiles = collectJSFiles(jsDir);

    // 创建路径规范化函数
    function normalizePath(filePath) {
        return filePath.replace(/\\/g, '/').toLowerCase();
    }

    // 创建已处理文件跟踪集合
    const actuallyProcessedFiles = new Set();

    // Add main files first
    for (const fileName of mainFileOrder) {
        const file = allFiles.find(f => f.relativePath === fileName);
        if (file) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ 1 Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;

            // 记录已处理的文件
            actuallyProcessedFiles.add(normalizePath(file.relativePath));
        } else {
            console.log(`⚠ File ${fileName} not found`);
        }
    }

    // Add component files in specific order
    for (const componentPath of componentLoadOrder) {
        const normalizedComponentPath = normalizePath(componentPath);

        // 尝试匹配不同的路径分隔符格式
        const file = allFiles.find(f => {
            const normalizedFilePath = normalizePath(f.relativePath);
            return normalizedFilePath === normalizedComponentPath;
        });

        if (file) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ 2 Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;

            // 记录已处理的文件
            actuallyProcessedFiles.add(normalizePath(file.relativePath));
        } else {
            console.log(`⚠ Component ${componentPath} not found`);
        }
    }

    // Add app.js last
    const appFile = allFiles.find(f => f.relativePath === 'app.js');
    if (appFile) {
        const content = fs.readFileSync(appFile.path, 'utf8');
        console.log(`✓ 3 Adding ${appFile.relativePath} (${content.length} chars)`);
        bundledCode += `// === ${appFile.relativePath} ===\n${content}\n\n`;

        // 记录已处理的文件
        actuallyProcessedFiles.add(normalizePath(appFile.relativePath));
    } else {
        console.log(`⚠ File app.js not found`);
    }

    // Add any remaining files (excluding already processed files)
    for (const file of allFiles) {
        const normalizedPath = normalizePath(file.relativePath);

        if (
            !actuallyProcessedFiles.has(normalizedPath) &&
            !excludeFiles.includes(file.name) &&
            !excludeFiles.includes(file.relativePath) &&
            excludeDirs.every(value => normalizedPath.indexOf(value) === -1)
        ) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ 4 Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;

            // 标记为已处理
            actuallyProcessedFiles.add(normalizedPath);
        }
    }

    // Log excluded files
    for (const excludeFile of excludeFiles) {
        const found = allFiles.some(f => f.name === excludeFile || f.relativePath === excludeFile);
        if (found) {
            console.log(`⚠ Skipping ${excludeFile} (loaded separately)`);
        }
    }

    // Minify in production
    if (process.env.NODE_ENV === 'production') {
        try {
            const result = await minify(bundledCode, {
                compress: {
                    drop_console: false, // Keep console logs for debugging
                    drop_debugger: true
                },
                mangle: false // Don't mangle names for easier debugging
            });
            bundledCode = result.code;
            console.log('✓ JavaScript minified');
        } catch (error) {
            console.error('✗ JavaScript minification failed:', error);
            // Continue with unminified code
        }
    }

    // Write bundled file
    const outputPath = path.join(publicDir, 'js', 'bundle.js');
    fs.writeFileSync(outputPath, bundledCode);
    console.log('✓ JavaScript bundled');
}

// Note: CSS is handled by the sass command in package.json
function checkCSS() {
    const cssPath = path.join(publicDir, 'styles', 'main.css');

    if (fs.existsSync(cssPath)) {
        console.log('✓ CSS file exists');
        return true;
    } else {
        console.log('ℹ CSS file not found - run "npm run build:css" first');
        return false;
    }
}

// Check assets
function checkAssets() {
    const assetsDir = path.join(publicDir, 'assets');

    if (fs.existsSync(assetsDir)) {
        console.log('✓ Assets directory exists');
        return true;
    } else {
        console.log('ℹ No assets directory found');
        return false;
    }
}

// Main build function
async function build() {
    console.log('🔨 Building MusicBox frontend...\n');

    try {
        await bundleJS();
        checkCSS();
        checkAssets();

        console.log('\n✅ Build completed successfully!');
        console.log(`📁 Output directory: ${publicDir}`);

    } catch (error) {
        console.error('\n❌ Build failed:', error);
        process.exit(1);
    }
}

// Run build if called directly
if (require.main === module) {
    build();
}

module.exports = {build, bundleJS, checkCSS, checkAssets};
