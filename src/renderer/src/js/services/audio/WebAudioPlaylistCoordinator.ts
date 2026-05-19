import {
    getTrackDuration,
    getTrackFilePath,
    getTrackTitle,
    normalizeTrack,
    type TrackSource
} from '@js/features/playback/service/audioEngine';
import type WebAudioPreloadCoordinator from './WebAudioPreloadCoordinator';
import type {WebAudioTrack} from './WebAudioTypes';

type WebAudioPlaylistState = {
    playlist: TrackSource[];
    currentIndex: number;
    gaplessPlaybackEnabled: boolean;
    preloadCoordinator: WebAudioPreloadCoordinator | null;
    getNextTrackIndex: (() => number) | null;
    getPreviousTrackIndex: (() => number) | null;
    currentTrack: WebAudioTrack | null;
};

type WebAudioPlaylistActions = {
    getState: () => WebAudioPlaylistState;
    setCurrentIndex: (index: number) => void;
    setCurrentBuffer: (buffer: AudioBuffer | null) => void;
    setDuration: (duration: number) => void;
    setCurrentTrack: (track: WebAudioTrack | null) => void;
    clearCurrentAudioBuffer: () => void;
    clearNextTrackBuffer: () => void;
    stop: () => boolean;
    loadTrack: (filePath: string) => Promise<boolean>;
    play: () => Promise<boolean>;
    notifyTrackChanged: () => void | Promise<void>;
};

class WebAudioPlaylistCoordinator {
    private readonly actions: WebAudioPlaylistActions;

    constructor(actions: WebAudioPlaylistActions) {
        this.actions = actions;
    }

    async preloadNextTrack(nextIndex: number | null = null): Promise<boolean> {
        const state = this.actions.getState();
        if (!state.gaplessPlaybackEnabled || state.playlist.length <= 1) {
            return false;
        }

        const resolvedIndex = this.resolveNextIndex(nextIndex, state);
        const nextTrackInfo = state.playlist[resolvedIndex];
        if (!nextTrackInfo) {
            return false;
        }

        const filePath = getTrackFilePath(nextTrackInfo);
        if (!filePath) {
            console.warn('⚠️ 下一首歌曲文件路径为空');
            return false;
        }

        return await this.loadNextTrackBuffer(filePath, nextTrackInfo);
    }

    async loadNextTrackBuffer(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        const preloadCoordinator = this.actions.getState().preloadCoordinator;
        if (!preloadCoordinator) {
            return false;
        }

        return await preloadCoordinator.preload(filePath, trackInfo);
    }

    async nextTrack(nextIndex: number | null = null): Promise<boolean> {
        const state = this.actions.getState();
        if (!this.canSwitchTrack(state, '下一首')) {
            return false;
        }

        this.prepareForTrackSwitch();

        const latestState = this.actions.getState();
        const resolvedIndex = this.resolveNextIndex(nextIndex, latestState);
        this.actions.setCurrentIndex(resolvedIndex);

        const nextTrack = latestState.playlist[resolvedIndex];
        const filePath = getTrackFilePath(nextTrack);
        if (!filePath) {
            console.error('❌ 下一首歌曲文件路径为空:', nextTrack);
            return false;
        }

        console.log(`⏭️ 切换到下一首 (索引 ${resolvedIndex}): ${getTrackTitle(nextTrack) || filePath}`);

        const canUsePreloadedBuffer = latestState.gaplessPlaybackEnabled &&
            latestState.preloadCoordinator?.hasPreloaded(filePath);
        if (canUsePreloadedBuffer) {
            return await this.playPreloadedTrack(filePath);
        }

        this.clearMismatchedPreload(filePath);
        return await this.loadAndPlayTrack(filePath, true);
    }

    async previousTrack(prevIndex: number | null = null): Promise<boolean> {
        const state = this.actions.getState();
        if (!this.canSwitchTrack(state, '上一首')) {
            return false;
        }

        this.prepareForTrackSwitch();

        const latestState = this.actions.getState();
        const resolvedIndex = this.resolvePreviousIndex(prevIndex, latestState);
        this.actions.setCurrentIndex(resolvedIndex);

        const previousTrack = latestState.playlist[resolvedIndex];
        const filePath = getTrackFilePath(previousTrack);
        if (!filePath) {
            console.error('❌ 上一首歌曲文件路径为空:', previousTrack);
            return false;
        }

        console.log(`⏮️ 切换到上一首 (索引 ${resolvedIndex}): ${getTrackTitle(previousTrack) || filePath}`);
        return await this.loadAndPlayTrack(filePath, false);
    }

    private canSwitchTrack(state: WebAudioPlaylistState, label: string): boolean {
        if (state.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        if (state.currentIndex === -1) {
            console.warn(`⚠️ 当前索引为-1，无法切换到${label}`);
            return false;
        }

        return true;
    }

    private prepareForTrackSwitch(): void {
        this.actions.clearCurrentAudioBuffer();
        this.actions.clearNextTrackBuffer();
        this.actions.stop();
    }

    private resolveNextIndex(nextIndex: number | null, state: WebAudioPlaylistState): number {
        if (nextIndex !== null && nextIndex >= 0 && nextIndex < state.playlist.length) {
            return nextIndex;
        }

        if (typeof state.getNextTrackIndex === 'function') {
            return state.getNextTrackIndex();
        }

        return (state.currentIndex + 1) % state.playlist.length;
    }

    private resolvePreviousIndex(prevIndex: number | null, state: WebAudioPlaylistState): number {
        if (prevIndex !== null && prevIndex >= 0 && prevIndex < state.playlist.length) {
            return prevIndex;
        }

        if (typeof state.getPreviousTrackIndex === 'function') {
            return state.getPreviousTrackIndex();
        }

        return state.currentIndex > 0 ? state.currentIndex - 1 : state.playlist.length - 1;
    }

    private async playPreloadedTrack(filePath: string): Promise<boolean> {
        console.log('🎵 使用预加载的音频缓冲区进行无间隙播放');
        this.actions.stop();
        this.actions.setCurrentBuffer(null);

        const preloadedTrack = this.actions.getState().preloadCoordinator?.getPreloaded();
        if (!preloadedTrack) {
            return false;
        }

        const duration = getTrackDuration(preloadedTrack.trackInfo) || preloadedTrack.buffer.duration || 0;
        this.actions.setCurrentBuffer(preloadedTrack.buffer);
        this.actions.setDuration(duration);
        this.actions.setCurrentTrack(normalizeTrack(preloadedTrack.trackInfo, filePath, duration));
        this.actions.clearNextTrackBuffer();

        const playResult = await this.actions.play();
        if (playResult) {
            await this.actions.notifyTrackChanged();
            this.schedulePreloadIfGapless();
        }

        return playResult;
    }

    private clearMismatchedPreload(filePath: string): void {
        const preloadCoordinator = this.actions.getState().preloadCoordinator;
        if (preloadCoordinator?.getPreloaded() && !preloadCoordinator.hasPreloaded(filePath)) {
            console.log('⚠️ 预加载的歌曲与目标歌曲不一致，清理预加载缓冲区');
            this.actions.clearNextTrackBuffer();
        }
    }

    private async loadAndPlayTrack(filePath: string, preloadNextAfterPlay: boolean): Promise<boolean> {
        const loadResult = await this.actions.loadTrack(filePath);
        if (!loadResult) {
            return false;
        }

        const playResult = await this.actions.play();
        if (playResult) {
            await this.actions.notifyTrackChanged();
        }

        if (playResult && preloadNextAfterPlay) {
            this.schedulePreloadIfGapless();
        }

        return playResult;
    }

    private schedulePreloadIfGapless(): void {
        if (this.actions.getState().gaplessPlaybackEnabled) {
            setTimeout(() => {
                void this.preloadNextTrack();
            }, 1000);
        }
    }
}

export {WebAudioPlaylistCoordinator};
export default WebAudioPlaylistCoordinator;
