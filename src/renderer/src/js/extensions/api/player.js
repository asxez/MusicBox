/**
 * Player API - 播放器控制 API
 * 提供音乐播放控制、播放列表管理、播放状态查询等功能
 */

import {validate, Validator} from './common/validation.js';
import {ErrorUtils, NotAvailableError} from './common/errors.js';
import {toDisposable} from '../core/Lifecycle.js';
import {api} from '@api/api';
import {app} from "@core/app";

/**
 * 播放模式枚举
 */
export const PlayMode = {
    SEQUENCE: 'sequence',      // 顺序播放
    SHUFFLE: 'shuffle',        // 随机播放
    REPEAT_ONE: 'repeat-one',  // 单曲循环
};

/**
 * 播放状态枚举
 */
export const PlaybackState = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    STOPPED: 'stopped'
};

/**
 * 创建播放器 API
 * @param {Object} context - 扩展上下文
 * @returns {PlayerAPI} 播放器 API 实例
 */
export function createPlayerAPI(context) {
    return {
        /**
         * 播放歌曲
         * @returns {Promise<boolean>}
         */
        async play() {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.play === 'function') {
                    return await api.play();
                } else {
                    throw new NotAvailableError('player.play', 'API 未初始化');
                }
            }, 'player.play');
        },

        /**
         * 按路径播放歌曲
         * @param {string} filePath
         * @returns {Promise<undefined>}
         */
        playTrack(filePath) {
            Validator.assertString(filePath, 'filePath');

            return ErrorUtils.wrapAsync(async () => {
                if (typeof app.loadAndPlayFile === 'function') {
                    await app.loadAndPlayFile(filePath);
                } else {
                    throw new NotAvailableError('player.playTrack', 'app 未初始化');
                }
            }, 'player.playTrack');
        },

        /**
         * 暂停播放
         * @returns {Promise<boolean>}
         */
        async pause() {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.pause === 'function') {
                    return await api.pause();
                } else {
                    throw new NotAvailableError('player.pause', 'API 未初始化');
                }
            }, 'player.pause');
        },

        /**
         * 停止播放
         * @returns {Promise<boolean>}
         */
        async stop() {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.stop === 'function') {
                    return await api.stop();
                } else {
                    throw new NotAvailableError('player.stop', 'API 未初始化');
                }
            }, 'player.stop');
        },

        /**
         * 下一首
         * @returns {Promise<boolean>}
         */
        async nextTrack() {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.nextTrack === 'function') {
                    return await api.nextTrack();
                } else {
                    throw new NotAvailableError('player.nextTrack', 'API 未初始化');
                }
            }, 'player.nextTrack');
        },

        /**
         * 上一首
         * @returns {Promise<boolean>}
         */
        async previousTrack() {
            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.previousTrack === 'function') {
                    return await api.previousTrack();
                } else {
                    throw new NotAvailableError('player.previousTrack', 'API 未初始化');
                }
            }, 'player.previousTrack');
        },

        /**
         * 设置音量
         * @param {number} volume - 音量 (0-1)
         * @returns {Promise<undefined>}
         */
        async setVolume(volume) {
            validate.volume(volume);

            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.setVolume === 'function') {
                    return await api.setVolume(volume);
                } else {
                    throw new NotAvailableError('player.setVolume', 'API 未初始化');
                }
            }, 'player.setVolume');
        },

        /**
         * 获取当前音量
         * @returns {number} 音量值 (0-1)
         */
        getVolume() {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.volume !== 'undefined') {
                    return api.volume;
                }
                return 0.7; // 默认音量
            }, 'player.getVolume');
        },

        /**
         * 获取当前播放状态
         * @returns {Object|null} 播放状态对象
         */
        getState() {
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

        /**
         * 获取当前歌曲
         * @returns {Object|null} 当前歌曲对象
         */
        getCurrentTrack() {
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

        /**
         * 跳转到指定时间
         * @param {number} time - 时间（秒）
         * @returns {Promise<boolean>}
         */
        async seek(time) {
            validate.time(time);

            return ErrorUtils.wrapAsync(async () => {
                if (typeof api.seek === 'function') {
                    return await api.seek(time);
                } else {
                    throw new NotAvailableError('player.seek', 'API 未初始化');
                }
            }, 'player.seek');
        },

        /**
         * 获取当前播放位置
         * @returns {number} 播放位置（秒）
         */
        getPosition() {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.getPosition === 'function') {
                    return api.getPosition();
                }
                return 0;
            }, 'player.getPosition');
        },

        /**
         * 获取当前歌曲时长
         * @returns {number} 时长（秒）
         */
        getDuration() {
            return ErrorUtils.wrapSync(() => {
                if (typeof api.getDuration === 'function') {
                    return api.getDuration();
                }
                return 0;
            }, 'player.getDuration');
        },

        /**
         * 设置播放列表
         * @param {Array<Object>} tracks - 歌曲列表
         * @param {number} [startIndex=-1] - 起始播放索引
         * @returns {Promise<boolean>}
         */
        async setPlaylist(tracks, startIndex = -1) {
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

        /**
         * 获取当前播放列表
         * @returns {Array<Object>} 播放列表
         */
        getPlaylist() {
            return ErrorUtils.wrapSync(() => {
                if (Array.isArray(api.playlist)) {
                    return [...api.playlist];
                }
                return [];
            }, 'player.getPlaylist');
        },

        /**
         * 设置播放模式
         * @param {string} mode - 播放模式 (sequence, shuffle, repeat-one, repeat-all)
         * @returns {Promise<boolean>}
         */
        setPlayMode(mode) {
            Validator.assertEnum(
                mode,
                Object.values(PlayMode),
                'mode'
            );

            return ErrorUtils.wrapSync(() => {
                if (typeof api.setPlayMode === 'function') {
                    return api.setPlayMode(mode);
                } else api.playMode = mode;
            }, 'player.setPlayMode');
        },

        /**
         * 获取播放模式
         * @returns {string} 播放模式
         */
        getPlayMode() {
            return ErrorUtils.wrapSync(() => {
                if (api.playMode) {
                    return api.playMode;
                }
                return PlayMode.SEQUENCE;
            }, 'player.getPlayMode');
        },

        /**
         * 监听歌曲变化事件
         * @param {Function} callback - 回调函数
         * @returns {Disposable} 可释放对象
         */
        onTrackChanged(callback) {
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

        /**
         * 监听播放状态变化事件
         * @param {Function} callback - 回调函数
         * @returns {Disposable} 可释放对象
         */
        onPlaybackStateChanged(callback) {
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
