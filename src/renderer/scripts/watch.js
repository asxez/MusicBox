#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { bundleJS } = require('./build.js');

const srcDir = path.join(__dirname, '..', 'src', 'js');

console.log('👀 Watching JavaScript files for changes...');

// Watch for changes in JS files
const watcher = chokidar.watch(path.join(srcDir, '*.js'), {
    ignored: /node_modules/,
    persistent: true
});

let isBuilding = false;

async function rebuild() {
    if (isBuilding) return;
    
    isBuilding = true;
    console.log('🔄 Rebuilding JavaScript...');
    
    try {
        await bundleJS();
        console.log('✅ JavaScript rebuilt successfully');
    } catch (error) {
        console.error('❌ JavaScript rebuild failed:', error);
    } finally {
        isBuilding = false;
    }
}

watcher
    .on('change', (filePath) => {
        console.log(`📝 File changed: ${path.basename(filePath)}`);
        rebuild();
    })
    .on('add', (filePath) => {
        console.log(`➕ File added: ${path.basename(filePath)}`);
        rebuild();
    })
    .on('unlink', (filePath) => {
        console.log(`➖ File removed: ${path.basename(filePath)}`);
        rebuild();
    })
    .on('error', (error) => {
        console.error('👀 Watcher error:', error);
    });

// Initial build
rebuild();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Stopping file watcher...');
    watcher.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    watcher.close();
    process.exit(0);
});
