/**
 * 菜单组件
 */

class ContextMenu extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.currentIndex = -1;

        this.setupElements();
        this.setupEventListeners();
    }

    setupElements() {
        this.menu = this.element;
        this.playItem = this.element.querySelector('#context-play');
        this.addToPlaylistItem = this.element.querySelector('#context-add-to-playlist');
        this.addToCustomPlaylistItem = this.element.querySelector('#context-add-to-custom-playlist');
        this.editInfoItem = this.element.querySelector('#context-edit-info');
        this.deleteItem = this.element.querySelector('#context-delete');
    }

    setupEventListeners() {
        this.playItem.addEventListener('click', () => {
            this.emit('play', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addToPlaylistItem.addEventListener('click', () => {
            this.emit('addToPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addToCustomPlaylistItem.addEventListener('click', () => {
            this.emit('addToCustomPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.editInfoItem.addEventListener('click', () => {
            this.emit('editInfo', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.deleteItem.addEventListener('click', () => {
            this.emit('delete', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(x, y, track, index) {
        this.currentTrack = track;
        this.currentIndex = index;
        this.isVisible = true;

        // Position the menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';

        // Adjust position if menu goes off screen
        const rect = this.menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            this.menu.style.left = `${windowWidth - rect.width - 10}px`;
        }

        if (rect.bottom > windowHeight) {
            this.menu.style.top = `${windowHeight - rect.height - 10}px`;
        }
    }

    hide() {
        this.isVisible = false;
        this.menu.style.display = 'none';
        this.currentTrack = null;
        this.currentIndex = -1;
    }
}

window.components.component.ContextMenu = ContextMenu;
