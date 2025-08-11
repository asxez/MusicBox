#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const srcDir = path.join(__dirname, '..', 'src');
const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Create subdirectories
const subdirs = ['js', 'styles'];
subdirs.forEach(dir => {
    const dirPath = path.join(publicDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Update HTML file for production
function updateHTML() {
    const htmlPath = path.join(publicDir, 'index.html');

    if (fs.existsSync(htmlPath)) {
        let content = fs.readFileSync(htmlPath, 'utf8');

        // Update script tags to use bundled file
        // 匹配旧的组件结构
        content = content.replace(
            /<script src="js\/utils\.js"><\/script>\s*<script src="js\/api\.js"><\/script>\s*<script src="js\/components\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/,
            '<script src="js/bundle.js"></script>'
        );

        // 匹配新的组件结构
        const newComponentScriptPattern = /<script src="js\/utils\.js"><\/script>\s*<script src="js\/api\.js"><\/script>\s*<script src="js\/components\/base\/Component\.js"><\/script>[\s\S]*?<script src="js\/app\.js"><\/script>/;
        if (newComponentScriptPattern.test(content)) {
            content = content.replace(
                newComponentScriptPattern,
                '<script src="js/bundle.js"></script>'
            );
        }

        fs.writeFileSync(htmlPath, content);
        console.log('✓ Updated index.html for production');
    } else {
        console.log('ℹ index.html not found - will be created by main build process');
    }
}

// Recursively collect all JavaScript files from a directory
function collectJSFiles(dir, basePath = '') {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

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

        // 2. 页面组件
        'components/component/ArtistsPage.js',
        'components/component/AlbumsPage.js',
        'components/component/ContextMenu.js',
        'components/component/EqualizerComponent.js',
        'components/component/HomePage.js',
        'components/component/Lyrics.js',
        'components/component/Navigation.js',
        'components/component/Player.js',
        'components/component/Playlist.js',
        'components/component/PlaylistDetailPage.js',
        'components/component/RecentPage.js',
        'components/component/Search.js',
        'components/component/Settings.js',
        'components/component/StatisticsPage.js',
        'components/component/TrackList.js',

        // 3. 对话框组件
        'components/dialogs/AddToPlaylistDialog.js',
        'components/dialogs/CreatePlaylistDialog.js',
        'components/dialogs/MusicLibrarySelectionDialog.js',
        'components/dialogs/RenamePlaylistDialog.js',

        // 4. 组件索引
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
        'embedded-cover-manager.js'
    ];

    // Collect all JavaScript files
    const allFiles = collectJSFiles(jsDir);

    // Add main files first
    for (const fileName of mainFileOrder) {
        const file = allFiles.find(f => f.relativePath === fileName);
        if (file) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;
        } else {
            console.log(`⚠ File ${fileName} not found`);
        }
    }

    // Add component files in specific order
    for (const componentPath of componentLoadOrder) {
        const file = allFiles.find(f => f.relativePath === componentPath);
        if (file) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;
        } else {
            console.log(`⚠ Component ${componentPath} not found`);
        }
    }

    // Add app.js last
    const appFile = allFiles.find(f => f.relativePath === 'app.js');
    if (appFile) {
        const content = fs.readFileSync(appFile.path, 'utf8');
        console.log(`✓ Adding ${appFile.relativePath} (${content.length} chars)`);
        bundledCode += `// === ${appFile.relativePath} ===\n${content}\n\n`;
    } else {
        console.log(`⚠ File app.js not found`);
    }

    // Add any remaining files (excluding specified files)
    const processedFiles = new Set([
        ...mainFileOrder,
        ...componentLoadOrder,
        'app.js'
    ]);

    for (const file of allFiles) {
        if (
            !processedFiles.has(file.relativePath) &&
            !excludeFiles.includes(file.name) &&
            !excludeFiles.includes(file.relativePath)
        ) {
            const content = fs.readFileSync(file.path, 'utf8');
            console.log(`✓ Adding ${file.relativePath} (${content.length} chars)`);
            bundledCode += `// === ${file.relativePath} ===\n${content}\n\n`;
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

// Utility function to copy directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
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

module.exports = { build, bundleJS, checkCSS, checkAssets };
