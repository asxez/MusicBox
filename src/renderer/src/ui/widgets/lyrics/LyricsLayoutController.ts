type AddDomListener = (
    element: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
) => void;

interface LyricsLayoutElements {
    page: HTMLElement;
    fullscreenBtn: HTMLElement;
    fullscreenIcon: HTMLElement;
    fullscreenExitIcon: HTMLElement;
    trackCover: HTMLImageElement;
    lyricsMain: HTMLElement;
    leftSide: HTMLElement;
}

interface LyricsLayoutControllerOptions {
    elements: LyricsLayoutElements;
    addDomListener: AddDomListener;
    isVisible: () => boolean;
}

class LyricsLayoutController {
    private readonly elements: LyricsLayoutElements;
    private readonly addDomListener: AddDomListener;
    private readonly isVisible: () => boolean;
    private fullscreen = false;
    private centerMode = false;
    private transitioning = false;
    private lastClickTime = 0;
    private readonly doubleClickDelay = 300;
    private clearHideTimer: (() => void) | null = null;
    private bound = false;

    constructor(options: LyricsLayoutControllerOptions) {
        this.elements = options.elements;
        this.addDomListener = options.addDomListener;
        this.isVisible = options.isVisible;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.elements.fullscreenBtn, 'click', () => {
            this.toggleFullscreen();
        });

        this.addDomListener(this.elements.trackCover, 'click', (event) => {
            void this.handleCoverClick(event as MouseEvent);
        });

        this.addDomListener(window, 'resize', () => {
            this.handleWindowResize();
        });

        this.bindMouseHide();

        this.addDomListener(document, 'fullscreenchange', () => {
            if (!this.fullscreen) this.clearHideTimer?.();
            this.updateFullscreenState();
        });

        this.bound = true;
    }

    toggleFullscreen(): void {
        if (this.fullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen(): void {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
                console.log('🎵 Lyrics: 进入全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 进入全屏失败:', err);
            });
        }
    }

    exitFullscreen(): void {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                console.log('🎵 Lyrics: 退出全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 退出全屏失败:', err);
            });
        }
    }

    updateFullscreenState(): boolean {
        this.fullscreen = !!document.fullscreenElement;

        if (this.fullscreen) {
            this.elements.fullscreenIcon.style.display = 'none';
            this.elements.fullscreenExitIcon.style.display = 'block';
        } else {
            this.elements.fullscreenIcon.style.display = 'block';
            this.elements.fullscreenExitIcon.style.display = 'none';
        }

        return this.fullscreen;
    }

    resetLayoutState(): void {
        this.centerMode = false;
        this.transitioning = false;
        this.elements.page.classList.remove('center-mode', 'dynamic-center');
        this.elements.leftSide.style.removeProperty('--dynamic-center-transform');
    }

    isFullscreen(): boolean {
        return this.fullscreen;
    }

    private bindMouseHide(): void {
        const hideDelay = 2000;
        let mouseTimer: ReturnType<typeof setTimeout> | null = null;

        const handleMouseMove = () => {
            if (this.isVisible() && this.fullscreen) {
                this.elements.page.classList.remove('hide-cursor');
                if (mouseTimer) clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    if (this.isVisible() && this.fullscreen) {
                        this.elements.page.classList.add('hide-cursor');
                    }
                }, hideDelay);
            }
        };

        this.addDomListener(this.elements.page, 'mousemove', handleMouseMove);

        this.clearHideTimer = () => {
            if (mouseTimer) clearTimeout(mouseTimer);
            mouseTimer = null;
            this.elements.page.classList.remove('hide-cursor');
        };
    }

    private async handleCoverClick(event: MouseEvent): Promise<void> {
        event.preventDefault();
        event.stopPropagation();

        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastClickTime;

        if (timeDiff < this.doubleClickDelay) {
            await this.handleCoverDoubleClick();
        }

        this.lastClickTime = currentTime;
    }

    private async handleCoverDoubleClick(): Promise<void> {
        if (this.transitioning) {
            return;
        }

        this.elements.trackCover.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.elements.trackCover.style.transform = '';
        }, 150);

        this.toggleLayoutMode();
    }

    private isLayoutSwitchSupported(): boolean {
        return window.innerWidth > 768;
    }

    private handleWindowResize(): void {
        if (this.centerMode && !this.isLayoutSwitchSupported()) {
            this.resetLayoutState();
            return;
        }

        if (this.centerMode && this.elements.page.classList.contains('dynamic-center')) {
            setTimeout(() => {
                this.applyDynamicCenter();
            }, 100);
        }
    }

    private calculateCenterTransform(): string {
        const pageRect = this.elements.page.getBoundingClientRect();
        const mainRect = this.elements.lyricsMain.getBoundingClientRect();
        const coverSection = this.elements.leftSide.querySelector('.lyrics-cover-section');
        if (!coverSection) {
            return 'translateX(0)';
        }

        const coverRect = coverSection.getBoundingClientRect();
        const pageCenterX = pageRect.width / 2;
        const contentCenterX = coverRect.left + coverRect.width / 2 - mainRect.left;
        const translateX = pageCenterX - contentCenterX;
        return `translateX(${translateX}px)`;
    }

    private applyDynamicCenter(): void {
        const transform = this.calculateCenterTransform();
        this.elements.leftSide.style.setProperty('--dynamic-center-transform', transform);
        this.elements.page.classList.add('dynamic-center');
    }

    private toggleLayoutMode(): void {
        if (this.transitioning || !this.isLayoutSwitchSupported()) {
            return;
        }

        this.transitioning = true;
        this.centerMode = !this.centerMode;
        if (this.centerMode) {
            this.applyDynamicCenter();
        } else {
            this.elements.page.classList.remove('dynamic-center');
        }

        this.elements.page.classList.toggle('center-mode', this.centerMode);

        setTimeout(() => {
            this.transitioning = false;
        }, 800);
    }
}

export {LyricsLayoutController};
export type {LyricsLayoutElements};
