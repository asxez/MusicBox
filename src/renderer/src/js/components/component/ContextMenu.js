/**
 * 菜单组件
 */

class ContextMenu extends Component {
    constructor(element) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.currentIndex = -1;
        this.listenersSetup = false; // 事件监听器是否已设置
        this.setupElements();
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
        this.addEventListenerManaged(this.playItem, 'click', () => {
            this.emit('play', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addEventListenerManaged(this.addToPlaylistItem, 'click', () => {
            this.emit('addToPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addEventListenerManaged(this.addToCustomPlaylistItem, 'click', () => {
            this.emit('addToCustomPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addEventListenerManaged(this.editInfoItem, 'click', () => {
            this.emit('editInfo', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addEventListenerManaged(this.deleteItem, 'click', () => {
            this.emit('delete', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        // 点击其他区域
        this.addEventListenerManaged(document, 'click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // ESC
        this.addEventListenerManaged(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(x, y, track, index) {
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.currentTrack = track;
        this.currentIndex = index;
        this.isVisible = true;

        // 菜单位置
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';

        // 若菜单离开屏幕，则调整位置
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

    destroy() {
        this.listenersSetup = false;
        return super.destroy();
    }
}

window.components.component.ContextMenu = ContextMenu;
