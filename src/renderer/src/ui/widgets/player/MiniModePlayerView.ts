import {MiniModeBackgroundController} from "@ui/widgets/player/MiniModeBackgroundController";
import {MiniModeLyricsController} from "@ui/widgets/player/MiniModeLyricsController";
import type {AddManagedDomListener, ManagedDomTarget, RemoveManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";
import type {Track} from "@api/types/track";

interface MiniModePlayerViewOptions {
    rootElement: Element | null;
    trackCover: HTMLImageElement;
    miniModeButton: HTMLButtonElement | null;
    addDomListener: AddManagedDomListener;
    removeDomListener: RemoveManagedDomListener;
}

class MiniModePlayerView {
    private readonly miniModeButton: HTMLButtonElement | null;
    private readonly addDomListener: MiniModePlayerViewOptions['addDomListener'];
    private readonly removeDomListener: MiniModePlayerViewOptions['removeDomListener'];
    private readonly backgroundController: MiniModeBackgroundController;
    private readonly lyricsController: MiniModeLyricsController;

    private active = false;
    private mouseEnterHandler: EventListener | null = null;
    private mouseLeaveHandler: EventListener | null = null;
    private appContainer: ManagedDomTarget | null = null;

    constructor(options: MiniModePlayerViewOptions) {
        this.miniModeButton = options.miniModeButton;
        this.addDomListener = options.addDomListener;
        this.removeDomListener = options.removeDomListener;
        this.backgroundController = new MiniModeBackgroundController(options.trackCover);
        this.lyricsController = new MiniModeLyricsController(options.rootElement);
    }

    async enter(track: Track | null, currentTime: number): Promise<void> {
        this.active = true;
        document.body.classList.add('mini-mode');
        document.body.classList.add('mini-mode-collapsed');
        this.updateButtonState(true);
        this.bindHoverCollapse();
        this.lyricsController.start();

        await this.updateBackground();
        await this.loadTrackLyrics(track, currentTime);
    }

    beginExit(): void {
        this.lyricsController.removeElement();
        document.body.classList.remove('mini-mode');
    }

    completeExit(): void {
        this.active = false;
        this.updateButtonState(false);
        this.unbindHoverCollapse();
        this.lyricsController.stop();
        document.body.classList.remove('mini-mode-collapsed');
        this.backgroundController.clear();
    }

    destroy(): void {
        document.body.classList.remove('mini-mode', 'mini-mode-collapsed');
        this.unbindHoverCollapse();
        this.lyricsController.stop();
        this.backgroundController.clear();
        this.active = false;
    }

    clearLyrics(): void {
        this.lyricsController.clear();
    }

    async updateBackground(): Promise<void> {
        if (!this.active) return;
        await this.backgroundController.update();
    }

    async loadTrackLyrics(track: Track | null, currentTime: number): Promise<void> {
        await this.lyricsController.loadTrackLyrics(track, currentTime);
    }

    private bindHoverCollapse(): void {
        if (this.appContainer) return;

        const appContainer = document.querySelector('.app') as ManagedDomTarget | null;
        if (!appContainer) return;

        this.mouseEnterHandler = () => {
            document.body.classList.remove('mini-mode-collapsed');
        };
        this.mouseLeaveHandler = () => {
            document.body.classList.add('mini-mode-collapsed');
        };

        this.addDomListener(appContainer, 'mouseenter', this.mouseEnterHandler);
        this.addDomListener(appContainer, 'mouseleave', this.mouseLeaveHandler);
        this.appContainer = appContainer;
    }

    private unbindHoverCollapse(): void {
        if (!this.appContainer || !this.mouseEnterHandler || !this.mouseLeaveHandler) {
            this.appContainer = null;
            this.mouseEnterHandler = null;
            this.mouseLeaveHandler = null;
            return;
        }

        this.removeDomListener(this.appContainer, 'mouseenter', this.mouseEnterHandler);
        this.removeDomListener(this.appContainer, 'mouseleave', this.mouseLeaveHandler);
        this.appContainer = null;
        this.mouseEnterHandler = null;
        this.mouseLeaveHandler = null;
    }

    private updateButtonState(active: boolean): void {
        if (!this.miniModeButton) return;

        if (active) {
            this.miniModeButton.classList.add('active');
            this.miniModeButton.title = '退出迷你模式';
            return;
        }

        this.miniModeButton.classList.remove('active');
        this.miniModeButton.title = '迷你模式';
    }
}

export {MiniModePlayerView};
