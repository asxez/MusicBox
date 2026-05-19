import {miniModeWindowService} from "@js/features/appShell/service";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import {showToast} from "@js/utils";
import type {MiniModePlayerView} from "@ui/widgets/player/MiniModePlayerView";
import type {PlayerCoverInteractionController} from "@ui/widgets/player/PlayerCoverInteractionController";
import type {Track} from "@api/types/track";

interface PlayerMiniModeControllerOptions {
    miniModeView: MiniModePlayerView;
    coverInteractionController: PlayerCoverInteractionController;
    getCurrentTime: () => number;
}

class PlayerMiniModeController {
    private readonly miniModeView: MiniModePlayerView;
    private readonly coverInteractionController: PlayerCoverInteractionController;
    private readonly getCurrentTime: () => number;

    private active = false;

    constructor(options: PlayerMiniModeControllerOptions) {
        this.miniModeView = options.miniModeView;
        this.coverInteractionController = options.coverInteractionController;
        this.getCurrentTime = options.getCurrentTime;
    }

    isActive(): boolean {
        return this.active;
    }

    async toggle(): Promise<void> {
        try {
            if (this.active) {
                await this.exit();
            } else {
                await this.enter();
            }

            miniModeWindowService.setPersistedMiniModeEnabled(this.active);
        } catch (error) {
            console.error('❌ Player: 切换迷你模式失败:', error);
            showToast('迷你模式切换失败', 'error');
        }
    }

    async enter(): Promise<void> {
        if (this.active) return;

        await miniModeWindowService.enterMiniMode();
        this.active = true;
        this.coverInteractionController.disableStandardInteractions();
        await this.miniModeView.enter(playbackUiStateService.getCurrentTrack(), this.getCurrentTime());
    }

    async exit(): Promise<void> {
        if (!this.active) return;

        this.active = false;
        this.miniModeView.beginExit();
        try {
            await miniModeWindowService.exitMiniMode();
        } finally {
            this.coverInteractionController.enableStandardInteractions();
            this.miniModeView.completeExit();
        }
    }

    async restore(): Promise<void> {
        if (miniModeWindowService.getPersistedMiniModeEnabled()) {
            this.active = false;
            await this.toggle();
        }
    }

    async updateBackground(): Promise<void> {
        if (!this.active) return;

        await this.miniModeView.updateBackground();
    }

    clearLyrics(): void {
        this.miniModeView.clearLyrics();
    }

    async loadTrackLyrics(track: Track | null, currentTime: number): Promise<void> {
        await this.miniModeView.loadTrackLyrics(track, currentTime);
    }

    destroy(): void {
        if (this.active) {
            this.miniModeView.destroy();
        }

        miniModeWindowService.stopResizeGuard();
        this.active = false;
    }
}

export {PlayerMiniModeController};
