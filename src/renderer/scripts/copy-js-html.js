const fs = require('fs');
const path = require('path');

function copy(src, dest) {
    fs.copyFileSync(path.join(__dirname, src), path.join(__dirname, dest));
}

const files = [
    ['../src/js/local-lyrics-manager.js', '../public/js/local-lyrics-manager.js'],
    ['../src/js/web-audio-engine.js', '../public/js/web-audio-engine.js'],
    ['../src/js/cache-manager.js', '../public/js/cache-manager.js'],
    ['../src/index.html', '../public/index.html'],
    ['../src/desktop-lyrics.html', '../public/desktop-lyrics.html'],
    ['../src/favicon.svg', '../public/favicon.svg'],
    ['../src/js/local-lyrics-manager.js', '../public/js/local-lyrics-manager.js'],
    ['../src/js/local-cover-manager.js', '../public/js/local-cover-manager.js'],
    ['../src/js/desktop-lyrics.js', '../public/js/desktop-lyrics.js'],
]
for (let file of files) {
    copy(file[0], file[1]);
}
