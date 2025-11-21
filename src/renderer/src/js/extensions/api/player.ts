/**
 * Player API - 播放器控制 API
 * 提供音乐播放控制、播放列表管理、播放状态查询等功能
 */

import {validate, Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {ExtensionContext, IDisposable, toDisposable} from '@extensions/core';
import {api} from '@api/api';
import {app} from "@core/app";
import {PlaybackStateType, PlayerAPI, PlayerState, PlayModeType, Track} from "@extensions/api/types/player";

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
                if (typeof api.play === 'function') {
                    return await api.play();
                } else {
                    throw new NotAvailableError('player.play', 'API 未初始化');
                }
            }, 'player.play');
        },

        playTrack(filePath: string): Promise<void> {
            Validator.assertString(filePath, 'filePath');

            return ErrorUtils.wrapAsync(async () => {
                if (typeof app.loadAndPlayFile === 'function') {
                    await app.loadAndPlayFile(filePath);
                } else {
                    throw new NotAvailableError('player.playTrack', 'app 未初始化');
                }
            }, 'player.playTrack');
        },

        async pause(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.pause === 'function') {
                    return await api.pause();
                } else {
                    throw new NotAvailableError('player.pause', 'API 未初始化');
                }
            }, 'player.pause');
        },

        async stop(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.stop === 'function') {
                    return await api.stop();
                } else {
                    throw new NotAvailableError('player.stop', 'API 未初始化');
                }
            }, 'player.stop');
        },

        async nextTrack(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.nextTrack === 'function') {
                    return await api.nextTrack();
                } else {
                    throw new NotAvailableError('player.nextTrack', 'API 未初始化');
                }
            }, 'player.nextTrack');
        },

        async previousTrack(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.previousTrack === 'function') {
                    return await api.previousTrack();
                } else {
                    throw new NotAvailableError('player.previousTrack', 'API 未初始化');
                }
            }, 'player.previousTrack');
        },

        async setVolume(volume: number): Promise<void> {
            validate.volume(volume);

            await ErrorUtils.wrapAsync(async () => {
                if (typeof api.setVolume === 'function') {
                    await api.setVolume(volume);
                } else {
                    throw new NotAvailableError('player.setVolume', 'API 未初始化');
                }
            }, 'player.setVolume');
        },

        getVolume(): number {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.volume !== 'undefined') {
                    return api.volume;
                }
                return 0.7; // 默认音量
            }, 'player.getVolume');
        },

        getState(): PlayerState {
            return ErrorUtils.wrapSync(() => {
                return {
                    isPlaying: api.isPlaying || false,
                    currentTrack: api.currentTrack || null,
                    position: api.position || 0,
                    duration: api.duration || 0,
                    volume: api.volume || 0.7
                };
            }, 'player.getState');
        },

        getCurrentTrack(): Track | null {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.getCurrentTrack === 'function') {
                    return api.getCurrentTrack();
                }
                if (api.currentTrack) {
                    return api.currentTrack;
                }
                return null;
            }, 'player.getCurrentTrack');
        },

        async seek(time: number): Promise<boolean> {
            validate.time(time);

            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.seek === 'function') {
                    return await api.seek(time);
                } else {
                    throw new NotAvailableError('player.seek', 'API 未初始化');
                }
            }, 'player.seek');
        },

        async getPosition(): Promise<number> {
            return await ErrorUtils.wrapAsync(async () => {
                if (typeof api.getPosition === 'function') {
                    return await api.getPosition();
                }
                return 0;
            }, 'player.getPosition');
        },

        getDuration(): number {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.getDuration === 'function') {
                    return api.getDuration();
                }
                return 0;
            }, 'player.getDuration');
        },

        async setPlaylist(tracks: Track[], startIndex: number = -1): Promise<boolean> {
            Validator.assertArray(tracks, 'tracks');
            if (startIndex !== -1) {
                Validator.assertNumber(startIndex, 'startIndex');
            }

            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.setPlaylist === 'function') {
                    return await api.setPlaylist(tracks, startIndex);
                } else {
                    throw new NotAvailableError('player.setPlaylist', 'API 未初始化');
                }
            }, 'player.setPlaylist');
        },

        getPlaylist(): Track[] {
            return ErrorUtils.wrapSync(() => {
                if (Array.isArray(api.playlist)) {
                    return [...api.playlist];
                }
                return [];
            }, 'player.getPlaylist');
        },

        setPlayMode(mode: PlayModeType): void {
            Validator.assertEnum(
                mode,
                Object.values(PlayMode),
                'mode'
            );

            ErrorUtils.wrapSync(() => {
                if (typeof api.setPlayMode === 'function') {
                    api.setPlayMode(mode);
                } else api.playMode = mode;
            }, 'player.setPlayMode');
        },

        getPlayMode(): PlayModeType {
            return ErrorUtils.wrapSync(() => {
                if (api.playMode) {
                    return api.playMode as PlayModeType;
                }
                return PlayMode.SEQUENCE;
            }, 'player.getPlayMode');
        },

        onTrackChanged(callback: (track: Track) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                if (typeof api.on === 'function') {
                    api.on('trackChanged', callback);
                    return toDisposable(() => {
                        if (api && typeof api.off === 'function') {
                            api.off('trackChanged', callback);
                        }
                    });
                }
                return toDisposable(() => {
                });
            }, 'player.onTrackChanged');
        },

        onPlaybackStateChanged(callback: (state: PlaybackStateType) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                if (typeof api.on === 'function') {
                    api.on('playbackStateChanged', callback);
                    return toDisposable(() => {
                        if (api && typeof api.off === 'function') {
                            api.off('playbackStateChanged', callback);
                        }
                    });
                }
                return toDisposable(() => {
                });
            }, 'player.onPlaybackStateChanged');
        }
    };
}
