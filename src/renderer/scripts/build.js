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
        content = content.replace(
            /<script src="js\/utils\.js"><\/script>\s*<script src="js\/api\.js"><\/script>\s*<script src="js\/components\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/,
            '<script src="js/bundle.js"></script>'
        );

        fs.writeFileSync(htmlPath, content);
        console.log('✓ Updated index.html for production');
    } else {
        console.error('✗ index.html not found');
    }
}

// Bundle and minify JavaScript
async function bundleJS() {
    const jsDir = path.join(srcDir, 'js');
    
    if (!fs.existsSync(jsDir)) {
        console.error('✗ JavaScript source directory not found');
        return;
    }
    
    const files = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));
    
    let bundledCode = '';
    
    // Read files in specific order (exclude web-audio-engine.js as it's loaded separately)
    const fileOrder = ['utils.js', 'api.js', 'components.js', 'app.js'];
    
    for (const file of fileOrder) {
        if (files.includes(file)) {
            const filePath = path.join(jsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`✓ Adding ${file} (${content.length} chars)`);
            bundledCode += `// === ${file} ===\n${content}\n\n`;
        } else {
            console.log(`⚠ File ${file} not found`);
        }
    }
    
    // Add any remaining files (exclude web-audio-engine.js)
    for (const file of files) {
        if (
            !fileOrder.includes(file) &&
            file !== 'web-audio-engine.js' &&
            file !== 'cache-manager.js' &&
            file !== 'local-lyrics-manager.js' &&
            file !== 'local-cover-manager.js' &&
            file !== 'desktop-lyrics.js' &&
            file !== 'embedded-lyrics-manager.js'
        ) {
            const filePath = path.join(jsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`✓ Adding ${file} (${content.length} chars)`);
            bundledCode += `// === ${file} ===\n${content}\n\n`;
        } else if (
            file === 'web-audio-engine.js' ||
            file === 'cache-manager.js' ||
            file === 'local-lyrics-manager.js' ||
            file === 'local-cover-manager.js' ||
            file === 'desktop-lyrics.js' ||
            file === 'embedded-lyrics-manager.js'
        ) {
            console.log(`⚠ Skipping ${file} (loaded separately)`);
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
