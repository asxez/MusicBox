const fs = require('fs');
const path = require('path');

function copy(src, dest) {
    const destPath = path.join(__dirname, '..', dest);
    const destDir = path.dirname(destPath);

    // 确保目标目录存在
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(path.join(__dirname, '..', src), destPath);
}

// 递归复制目录
function copyDirectory(src, dest) {
    const srcPath = path.join(__dirname, '..', src);
    const destPath = path.join(__dirname, '..', dest);

    if (!fs.existsSync(srcPath)) {
        console.warn(`⚠ Source directory not found: ${src}`);
        return;
    }

    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }

    const entries = fs.readdirSync(srcPath, { withFileTypes: true });

    for (const entry of entries) {
        const srcEntryPath = path.join(srcPath, entry.name);
        const destEntryPath = path.join(destPath, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(path.join(src, entry.name), path.join(dest, entry.name));
        } else {
            fs.copyFileSync(srcEntryPath, destEntryPath);
        }
    }
}

const files = [
    ['src/js/local-lyrics-manager.js', 'public/js/local-lyrics-manager.js'],
    ['src/js/web-audio-engine.js', 'public/js/web-audio-engine.js'],
    ['src/js/cache-manager.js', 'public/js/cache-manager.js'],
    ['src/index.html', 'public/index.html'],
    ['src/desktop-lyrics.html', 'public/desktop-lyrics.html'],
    ['src/favicon.svg', 'public/favicon.svg'],
    ['src/js/local-lyrics-manager.js', 'public/js/local-lyrics-manager.js'],
    ['src/js/local-cover-manager.js', 'public/js/local-cover-manager.js'],
    ['src/js/desktop-lyrics.js', 'public/js/desktop-lyrics.js'],
    ['src/js/embedded-lyrics-manager.js', 'public/js/embedded-lyrics-manager.js'],
    ['src/js/embedded-cover-manager.js', 'public/js/embedded-cover-manager.js'],
    ['src/js/url-validator.js', 'public/js/url-validator.js'],
    ['src/js/cover-update-manager.js', 'public/js/cover-update-manager.js'],

    // 插件系统示例扩展
    ['src/js/plugin-system/examples/hello-world-extension/extension.js', 'public/js/plugin-system/examples/hello-world-extension/extension.js'],
    ['src/js/plugin-system/examples/hello-world-extension/manifest.json', 'public/js/plugin-system/examples/hello-world-extension/manifest.json'],
];

for (let file of files) {
    try {
        copy(file[0], file[1]);
        console.log(`✓ Copied ${file[0]} -> ${file[1]}`);
    } catch (error) {
        console.error(`✗ Failed to copy ${file[0]}:`, error.message);
    }
}

// 复制内置插件目录
console.log('\n📦 Copying builtin plugins...');
try {
    copyDirectory('src/js/plugin-system/builtin', 'public/js/plugin-system/builtin');
    console.log('✓ Builtin plugins copied successfully');
} catch (error) {
    console.error('✗ Failed to copy builtin plugins:', error.message);
}
