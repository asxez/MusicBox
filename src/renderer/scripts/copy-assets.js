#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcAssetsDir = path.join(__dirname, '..', 'src', 'assets');
const publicAssetsDir = path.join(__dirname, '..', 'public', 'assets');

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

// Copy assets if source directory exists
if (fs.existsSync(srcAssetsDir)) {
    console.log('📁 Copying assets...');
    copyDirectory(srcAssetsDir, publicAssetsDir);
    console.log('✅ Assets copied successfully');
} else {
    console.log('ℹ No source assets directory found, skipping...');
}

module.exports = { copyDirectory };
