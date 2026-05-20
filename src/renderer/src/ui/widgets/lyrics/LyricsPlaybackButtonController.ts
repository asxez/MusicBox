import {playbackUiStateService} from "@/features/playback/service/PlaybackUiStateService";
import type {PlayMode} from "@api/types/playback";
import type {AddLyricsDomListener} from "@ui/widgets/lyrics/LyricsDomEvents";

interface LyricsPlaybackButtonElements {
    playBtn: HTMLElement;
    prevBtn: HTMLElement;
    nextBtn: HTMLElement;
    playIcon: HTMLElement;
    pauseIcon: HTMLElement;
    playModeBtn: HTMLElement;
    modeSequenceIcon: HTMLElement;
    modeShuffleIcon: HTMLElement;
    modeRepeatOneIcon: HTMLElement;
}

interface LyricsPlaybackButtonControllerOptions {
    elements: LyricsPlaybackButtonElements;
    addDomListener: AddLyricsDomListener;
}

class LyricsPlaybackButtonController {
    private readonly elements: LyricsPlaybackButtonElements;
    private readonly addDomListener: AddLyricsDomListener;
    private playing = false;
    private toggleInProgress = false;
    private bound = false;

    constructor(options: LyricsPlaybackButtonControllerOptions) {
        this.elements = options.elements;
        this.addDomListener = options.addDomListener;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.elements.playBtn, 'click', () => {
            void this.togglePlayPause();
        });

        this.addDomListener(this.elements.prevBtn, 'click', () => {
            void playbackUiStateService.previousTrack();
        });

        this.addDomListener(this.elements.nextBtn, 'click', () => {
            void playbackUiStateService.nextTrack();
        });

        this.addDomListener(this.elements.playModeBtn, 'click', () => {
            const newMode = playbackUiStateService.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        this.bound = true;
    }

    setPlaying(isPlaying: boolean): void {
        this.playing = isPlaying;
        this.updatePlayButton();
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.elements.modeSequenceIcon.style.display = 'none';
        this.elements.modeShuffleIcon.style.display = 'none';
        this.elements.modeRepeatOneIcon.style.display = 'none';

        switch (mode) {
            case 'sequence':
                this.elements.modeSequenceIcon.style.display = 'block';
                this.elements.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.elements.modeShuffleIcon.style.display = 'block';
                this.elements.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.elements.modeRepeatOneIcon.style.display = 'block';
                this.elements.playModeBtn.title = '单曲循环';
                break;
            default:
                this.elements.modeSequenceIcon.style.display = 'block';
                this.elements.playModeBtn.title = '顺序播放';
                break;
        }
    }

    async togglePlayPause(): Promise<void> {
        if (this.toggleInProgress) {
            return;
        }

        this.toggleInProgress = true;
        try {
            if (this.playing) {
                const result = await playbackUiStateService.pause();
                if (!result) {
                    console.error('❌ Lyrics: 暂停失败');
                }
            } else {
                const result = await playbackUiStateService.play();
                if (!result) {
                    console.error('❌ Lyrics: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Lyrics: 切换播放状态失败:', error);
        } finally {
            setTimeout(() => {
                this.toggleInProgress = false;
            }, 100);
        }
    }

    private updatePlayButton(): void {
        if (this.playing) {
            this.elements.playIcon.style.display = 'none';
            this.elements.pauseIcon.style.display = 'block';
        } else {
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
        }
    }
}

export {LyricsPlaybackButtonController};
export type {LyricsPlaybackButtonElements};
