/**
 * Player API - 播放器控制 API
 * 提供音乐播放控制、播放列表管理、播放状态查询等功能
 */

import {validate, Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {ExtensionContext, IDisposable, toDisposable} from '@extensions/core';
import {extensionHostService} from "@js/features/extensions/service";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import {PlaybackStateType, PlayerAPI, PlayerState, PlayModeType, Track} from "@extensions/api/types/player";
import type {Track as ApiTrack} from '@api/types/track';

/**
 * 播放模式枚举
 */
export const PlayMode = {
    SEQUENCE: 'sequence',      // 顺序播放
    SHUFFLE: 'shuffle',        // 随机播放
    REPEAT_ONE: 'repeat-one',  // 单曲循环
} as const;

/**
 * 播放状态枚举
 */
export const PlaybackState = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    STOPPED: 'stopped'
} as const;


/**
 * 创建播放器 API
 * @param {ExtensionContext} _context - 扩展上下文
 * @returns {PlayerAPI} 播放器 API 实例
 */
export function createPlayerAPI(_context: ExtensionContext): PlayerAPI {
    return {
        async play(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.play();
            }, 'player.play');
        },

        playTrack(filePath: string): Promise<void> {
            Validator.assertString(filePath, 'filePath');

            return ErrorUtils.wrapAsync(async () => {
                try {
                    await extensionHostService.loadAndPlayFile(filePath);
                } catch (_error) {
                    throw new NotAvailableError('player.playTrack', 'app 未初始化');
                }
            }, 'player.playTrack');
        },

        async pause(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.pause();
            }, 'player.pause');
        },

        async stop(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.stop();
            }, 'player.stop');
        },

        async nextTrack(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.nextTrack();
            }, 'player.nextTrack');
        },

        async previousTrack(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.previousTrack();
            }, 'player.previousTrack');
        },

        async setVolume(volume: number): Promise<void> {
            validate.volume(volume);

            await ErrorUtils.wrapAsync(async () => {
                await playbackUiStateService.setVolume(volume);
            }, 'player.setVolume');
        },

        getVolume(): number {
            return ErrorUtils.wrapSync(() => {
                return playbackUiStateService.getVolume();
            }, 'player.getVolume');
        },

        getState(): PlayerState {
            return ErrorUtils.wrapSync(() => {
                const state = playbackUiStateService.getState();
                return {
                    isPlaying: state.isPlaying,
                    currentTrack: state.currentTrack as unknown as Track | null,
                    position: state.position,
                    duration: state.duration,
                    volume: state.volume
                };
            }, 'player.getState');
        },

        getCurrentTrack(): Track | null {
            return ErrorUtils.wrapSync(() => {
                return playbackUiStateService.getCurrentTrackSnapshot() as unknown as Track | null;
            }, 'player.getCurrentTrack');
        },

        async seek(time: number): Promise<boolean> {
            validate.time(time);

            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.seek(time);
            }, 'player.seek');
        },

        async getPosition(): Promise<number> {
            return await ErrorUtils.wrapAsync(async () => {
                return playbackUiStateService.getState().position;
            }, 'player.getPosition');
        },

        getDuration(): number {
            return ErrorUtils.wrapSync(() => {
                return playbackUiStateService.getDuration();
            }, 'player.getDuration');
        },

        async setPlaylist(tracks: Track[], startIndex: number = -1): Promise<boolean> {
            Validator.assertArray(tracks, 'tracks');
            if (startIndex !== -1) {
                Validator.assertNumber(startIndex, 'startIndex');
            }

            return ErrorUtils.wrapAsync(async () => {
                return await playbackUiStateService.setPlaylist(tracks as unknown as ApiTrack[], startIndex);
            }, 'player.setPlaylist');
        },

        getPlaylist(): Track[] {
            return ErrorUtils.wrapSync(() => {
                return [...playbackUiStateService.getPlaylist()] as unknown as Track[];
            }, 'player.getPlaylist');
        },

        setPlayMode(mode: PlayModeType): void {
            Validator.assertEnum(
                mode,
                Object.values(PlayMode),
                'mode'
            );

            ErrorUtils.wrapSync(() => {
                playbackUiStateService.setPlayMode(mode);
            }, 'player.setPlayMode');
        },

        getPlayMode(): PlayModeType {
            return ErrorUtils.wrapSync(() => {
                return playbackUiStateService.getPlayMode() as PlayModeType || PlayMode.SEQUENCE;
            }, 'player.getPlayMode');
        },

        onTrackChanged(callback: (track: Track) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                const unsubscribe = playbackUiStateService.on('trackChanged', callback as any);
                return toDisposable(unsubscribe);
            }, 'player.onTrackChanged');
        },

        onPlaybackStateChanged(callback: (state: PlaybackStateType) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                const unsubscribe = playbackUiStateService.on('playbackStateChanged', callback as any);
                return toDisposable(unsubscribe);
            }, 'player.onPlaybackStateChanged');
        }
    };
}
