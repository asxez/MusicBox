/**
 * 菜单组件
 */

import {Component} from "@ui/base/Component";
import type {Track} from "@api/types/library";

class ContextMenu extends Component {
    declare element: HTMLElement;
    private isVisible: boolean;
    private currentTrack: Track | null;
    private currentIndex: number;
    private selectedTracks: Set<number> | null;
    private listenersSetup: boolean;
    private menu!: HTMLElement;
    private playItem!: HTMLElement;
    private addToPlaylistItem!: HTMLElement;
    private addToCustomPlaylistItem!: HTMLElement;
    private editInfoItem!: HTMLElement;
    private deleteItem!: HTMLElement;
    private batchDeleteItem!: HTMLElement;
    private batchDeleteLabel!: HTMLElement;

    constructor(element: HTMLElement | null) {
        super(element);
        this.element = element as HTMLElement;
        this.isVisible = false;
        this.currentTrack = null;
        this.currentIndex = -1;
        this.selectedTracks = null;
        this.listenersSetup = false;
    }

    show(x: number, y: number, track: Track, index: number, selectedTracks: Set<number> | null = null): void {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.currentTrack = track;
        this.currentIndex = index;
        this.selectedTracks = selectedTracks;
        this.isVisible = true;

        // 多选模式：隐藏单曲操作，显示批量删除
        const isMulti = selectedTracks && selectedTracks.size > 1;
        this.playItem.style.display = isMulti ? 'none' : '';
        this.addToPlaylistItem.style.display = isMulti ? 'none' : '';
        this.addToCustomPlaylistItem.style.display = isMulti ? 'none' : '';
        this.editInfoItem.style.display = isMulti ? 'none' : '';
        this.deleteItem.style.display = isMulti ? 'none' : '';
        this.batchDeleteItem.style.display = isMulti ? '' : 'none';
        if (isMulti) {
            this.batchDeleteLabel.textContent = `批量删除 (${selectedTracks.size} 首)`;
        }

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

    hide(): void {
        this.isVisible = false;
        this.menu.style.display = 'none';
        this.currentTrack = null;
        this.currentIndex = -1;
        this.selectedTracks = null;
    }

    destroy(): void {
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements(): void {
        this.menu = this.element;
        this.playItem = this.element.querySelector('#context-play') as HTMLElement;
        this.addToPlaylistItem = this.element.querySelector('#context-add-to-playlist') as HTMLElement;
        this.addToCustomPlaylistItem = this.element.querySelector('#context-add-to-custom-playlist') as HTMLElement;
        this.editInfoItem = this.element.querySelector('#context-edit-info') as HTMLElement;
        this.deleteItem = this.element.querySelector('#context-delete') as HTMLElement;
        this.batchDeleteItem = this.element.querySelector('#context-batch-delete') as HTMLElement;
        this.batchDeleteLabel = this.element.querySelector('#context-batch-delete-label') as HTMLElement;
    }

    setupEventListeners(): void {
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

        this.addEventListenerManaged(this.batchDeleteItem, 'click', () => {
            this.emit('batchDelete', {selectedTracks: this.selectedTracks, track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        // 点击其他区域
        this.addEventListenerManaged(document, 'click', (e: Event) => {
            if (this.isVisible && e.target instanceof Node && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // ESC
        this.addEventListenerManaged(document, 'keydown', (e: Event) => {
            const event = e as KeyboardEvent;
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
}

export { ContextMenu };
