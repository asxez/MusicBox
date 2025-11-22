/**
 * 基于 Web Audio API 的音频引擎
 */

import {embeddedCoverManager} from "@services/cover/EmbeddedCoverManager";

class WebAudioEngine {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.currentTrack = null;
        this.playlist = [];
        this.currentIndex = -1;

        // 均衡器相关属性
        this.equalizer = null;
        this.equalizerEnabled = false;
        this.onEqualizerChanged = null;

        // 事件回调
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;

        // 播放模式回调：用于获取下一首/上一首的索引
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;

        // 进度更新定时器
        this.progressTimer = null;

        // 封面对象URL管理
        this.coverObjectUrls = new Set();

        // 无间隙播放相关属性
        this.gaplessPlaybackEnabled = true; // 默认启用无间隙播放
        this.nextAudioBuffer = null; // 下一首歌曲的音频缓冲区
        this.nextTrackInfo = null; // 下一首歌曲信息
        this.isPreloading = false; // 是否正在预加载
        this.preloadPromise = null; // 预加载Promise

        // 窗口可见性监听和内存管理
        this.isWindowVisible = true;
        this.memoryCleanupTimer = null;
    }

    async initialize() {
        try {
            // 初始化窗口可见性监听
            this.initVisibilityListener();
            this.audioContext = new window.AudioContext();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            this.initializeEqualizer();
            return true;
        } catch (error) {
            console.error('❌ Web Audio Engine 初始化失败:', error);
            return false;
        }
    }

    async loadTrack(filePath) {
        try {
            this.stop();

            // 清理旧的音频缓冲区以释放内存
            this.clearCurrentAudioBuffer();

            let arrayBuffer;
            if (window.electronAPI && window.electronAPI.readAudioFile) {
                arrayBuffer = await window.electronAPI.readAudioFile(filePath);
            } else {
                const fileUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio file: ${response.status}`);
                }
                arrayBuffer = await response.arrayBuffer();
            }

            // 解码音频数据
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            const webAudioDuration = this.audioBuffer.duration;

            // 清理arrayBuffer引用以释放内存
            arrayBuffer = null;
            const metadata = await this.getTrackMetadata(filePath);
            this.duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : webAudioDuration;

            // 处理内嵌封面
            let coverUrl = null;
            if (metadata.cover && metadata.cover.data) {
                try {
                    if (embeddedCoverManager) {
                        const coverResult = embeddedCoverManager.convertCoverToUrl(metadata.cover);
                        if (coverResult.success && typeof coverResult.url === 'string') {
                            coverUrl = coverResult.url;
                            this.coverObjectUrls.add(coverUrl);
                        }
                    } else {
                        // 直接处理封面数据
                        const coverBlob = new Blob([metadata.cover.data], {
                            type: `image/${metadata.cover.format.toLowerCase()}`
                        });
                        coverUrl = URL.createObjectURL(coverBlob);
                        this.coverObjectUrls.add(coverUrl);
                    }
                } catch (error) {
                    console.error('封面处理失败:', error);
                }
            }

            // 验证封面URL格式
            if (coverUrl && typeof coverUrl !== 'string') {
                coverUrl = null;
            }

            // 更新当前歌曲信息
            this.currentTrack = {
                filePath: filePath,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration: this.duration,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                cover: coverUrl
            };

            // 触发事件
            if (this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            // 若启用无间隙播放，预加载下一首歌曲
            if (this.gaplessPlaybackEnabled && this.playlist.length > 1) {
                setTimeout(() => this.preloadNextTrack(), 2000);
            }
            return true;
        } catch (error) {
            console.error('❌ 音频文件加载失败:', error);
            return false;
        }
    }

    // 播放音频
    async play() {
        try {
            if (!this.audioBuffer) {
                return false;
            }

            // 恢复音频上下文（用户交互后需要）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 如果已经在播放且未暂停，不重复播放
            if (this.isPlaying && !this.isPaused) {
                return true;
            }

            // 停止当前播放
            if (this.sourceNode) {
                try {
                    this.sourceNode.onended = null; // 移除回调避免意外触发
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                    // 忽略已停止的错误
                }
                this.sourceNode = null;
            }

            // 创建新的音频源
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer;

            // 连接到音频链
            this.connectSourceToChain();

            // 设置播放结束回调
            this.sourceNode.onended = () => {
                if (this.isPlaying) {
                    this.onTrackEnded();
                }
            };

            // 开始播放
            const offset = this.isPaused ? this.pauseTime : 0;

            // 确保偏移量在有效范围内
            const validOffset = Math.max(0, Math.min(offset, this.duration - 0.1));
            console.log(`▶️ 开始播放，原始偏移量: ${offset.toFixed(2)}s, 有效偏移量: ${validOffset.toFixed(2)}s, 音频时长: ${this.duration.toFixed(2)}s`);

            try {
                this.sourceNode.start(0, validOffset);
                this.startTime = this.audioContext.currentTime - validOffset;

                // 如果偏移量被调整了，更新pauseTime
                if (validOffset !== offset) {
                    this.pauseTime = validOffset;

                }
            } catch (startError) {
                console.error('❌ 音频源启动失败:', startError);


                // 重新创建音频源并从头开始
                this.sourceNode = this.audioContext.createBufferSource();
                this.sourceNode.buffer = this.audioBuffer;

                // 连接到音频链
                this.connectSourceToChain();
                this.sourceNode.onended = () => {
                    if (this.isPlaying) {
                        this.onTrackEnded();
                    }
                };

                this.sourceNode.start(0, 0);
                this.startTime = this.audioContext.currentTime;
                this.pauseTime = 0;
                this.isPaused = false;
            }

            this.isPlaying = true;
            this.isPaused = false;

            // 开始进度更新
            this.startProgressTimer();

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(true);
            }

            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    // 暂停播放
    async pause() {
        try {
            if (!this.isPlaying && !this.sourceNode) {
                console.log('⚠️ 音频未在播放且无音频源，无法暂停');
                return false;
            }

            if (!this.isPlaying) {
                console.log('⚠️ 状态显示未播放，但仍尝试暂停');
            }

            // 记录暂停位置
            const currentPosition = this.audioContext.currentTime - this.startTime;
            this.pauseTime = Math.max(0, Math.min(currentPosition, this.duration - 0.1));
            console.log(`🔄 暂停位置计算: currentTime=${this.audioContext.currentTime.toFixed(2)}, startTime=${this.startTime.toFixed(2)}, 计算位置=${currentPosition.toFixed(2)}, 最终位置=${this.pauseTime.toFixed(2)}`);

            // 如果计算出的位置异常，使用当前进度
            if (this.pauseTime < 0 || this.pauseTime >= this.duration) {
                const fallbackPosition = await this.getPosition();
                console.log(`⚠️ 暂停位置异常，使用备用位置: ${fallbackPosition.toFixed(2)}s`);
                this.pauseTime = Math.max(0, Math.min(fallbackPosition, this.duration - 0.1));
            }

            // 停止音频源（不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = true;

            // 停止进度更新
            this.stopProgressTimer();
            console.log(`⏸️ 暂停播放，位置: ${this.pauseTime.toFixed(2)}s`);

            // 触发事件
            if (this.onPlaybackStateChanged) {
                console.log('🔄 Web Audio Engine: 触发暂停状态变化事件');
                this.onPlaybackStateChanged(false);
            } else {
                console.warn('⚠️ Web Audio Engine: onPlaybackStateChanged 回调未设置');
            }
            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    // 停止播放
    stop() {
        try {
            // 停止音频源（不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = false;
            this.startTime = 0;
            this.pauseTime = 0;

            // 停止进度更新
            this.stopProgressTimer();
            if (!this.isWindowVisible) {
                this.cleanupCoverUrls();
                this.clearCurrentAudioBuffer();
            }

            // 触发事件
            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }

            // 触发位置重置事件
            if (this.onPositionChanged) {
                this.onPositionChanged(0);
            }

            // 在窗口隐藏时执行内存清理
            if (!this.isWindowVisible) {
                setTimeout(() => this.performMemoryCleanup(), 0);
            }

            console.log('⏹️ 停止播放');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    // 清理封面对象URL
    cleanupCoverUrls() {
        for (const url of this.coverObjectUrls) {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn('⚠️ 清理封面URL失败:', error);
            }
        }
        this.coverObjectUrls.clear();
    }

    // 跳转到指定位置
    async seek(position) {
        try {
            if (!this.audioBuffer) {
                return false;
            }

            const wasPlaying = this.isPlaying;

            // 停止当前播放（但不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 临时移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            // 停止进度更新
            this.stopProgressTimer();

            // 设置新位置
            this.pauseTime = Math.max(0, Math.min(position, this.duration));
            this.isPaused = true;
            this.isPlaying = false;
            console.log(`⏭️ 跳转到: ${position.toFixed(2)}s`);

            // 如果之前在播放，继续播放
            if (wasPlaying) {
                await this.play();
            }

            // 触发位置更新事件
            if (this.onPositionChanged) {
                this.onPositionChanged(this.pauseTime);
            }
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    // 设置音量
    setVolume(volume) {
        try {
            this.volume = Math.max(0, Math.min(1, volume));

            if (this.gainNode) {
                // 使用线性渐变避免音量突变
                this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
            }

            console.log(`🔊 音量设置为: ${(this.volume * 100).toFixed(0)}%`);

            // 触发事件
            if (this.onVolumeChanged) {
                this.onVolumeChanged(this.volume);
            }

            return true;
        } catch (error) {
            console.error('❌ 音量设置失败:', error);
            return false;
        }
    }

    // 获取当前音量
    getVolume() {
        return this.volume;
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled) {
        this.gaplessPlaybackEnabled = enabled;
        console.log(`🎵 WebAudioEngine: 无间隙播放${enabled ? '启用' : '禁用'}`);

        // 如果禁用无间隙播放，清理预加载的资源
        if (!enabled) {
            this.clearNextTrackBuffer();
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback() {
        return this.gaplessPlaybackEnabled;
    }

    // 获取当前播放位置
    async getPosition() {
        if (!this.isPlaying && !this.isPaused) {
            return 0;
        }

        if (this.isPaused) {
            return this.pauseTime;
        }

        return this.audioContext.currentTime - this.startTime;
    }

    // 获取音频时长
    getDuration() {
        return this.duration;
    }

    // 获取当前歌曲信息
    getCurrentTrack() {
        return this.currentTrack;
    }

    // 设置播放列表
    setPlaylist(tracks, startIndex = -1) {
        this.playlist = tracks;
        this.currentIndex = startIndex; // 设置起始索引

        console.log(`📋 播放列表设置: ${tracks.length}首歌曲，起始索引: ${startIndex}`);
        if (tracks.length > 0) {
            console.log('📋 第一首歌曲信息:', tracks[0]);
            if (startIndex >= 0 && startIndex < tracks.length) {
                console.log('📋 当前选中歌曲:', tracks[startIndex]);
            }
            console.log('📋 歌曲数据结构:', {
                hasFilePath: !!tracks[0].filePath,
                hasTitle: !!tracks[0].title,
                hasArtist: !!tracks[0].artist,
                keys: Object.keys(tracks[0])
            });
        }

        return true;
    }

    // 清理当前音频缓冲区
    clearCurrentAudioBuffer() {
        if (this.audioBuffer) {
            this.audioBuffer = null;

            // 在窗口隐藏时强制垃圾回收
            if (!this.isWindowVisible) {
                setTimeout(() => this.forceGarbageCollection(), 0);
            }
        }
    }

    // 清理下一首歌曲的缓冲区
    clearNextTrackBuffer() {
        if (this.nextAudioBuffer) {
            this.nextAudioBuffer = null;
            this.nextTrackInfo = null;

            // 在窗口隐藏时强制垃圾回收
            if (!this.isWindowVisible) {
                setTimeout(() => this.forceGarbageCollection(), 0);
            }
        }
    }

    // 预加载下一首歌曲
    async preloadNextTrack(nextIndex = null) {
        if (!this.gaplessPlaybackEnabled || this.playlist.length <= 1) {
            return false;
        }

        // 如果已经在预加载，等待完成
        if (this.isPreloading && this.preloadPromise) {
            return await this.preloadPromise;
        }

        // 计算下一首歌曲的索引：优先使用提供的nextIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (nextIndex === null || nextIndex < 0 || nextIndex >= this.playlist.length) {
            if (typeof this.getNextTrackIndex === 'function') {
                nextIndex = this.getNextTrackIndex();
            } else {
                nextIndex = (this.currentIndex + 1) % this.playlist.length;
            }
        }
        const nextTrackInfo = this.playlist[nextIndex];

        if (!nextTrackInfo) {
            return false;
        }

        const filePath = nextTrackInfo.filePath || nextTrackInfo.path || nextTrackInfo;
        if (!filePath) {
            console.warn('⚠️ 下一首歌曲文件路径为空');
            return false;
        }

        // 若已预加载了相同歌曲，直接返回
        if (this.nextTrackInfo && this.nextTrackInfo.filePath === filePath && this.nextAudioBuffer) {
            console.log('✅ 下一首歌曲已预加载:', nextTrackInfo.title || filePath);
            return true;
        }

        this.isPreloading = true;
        this.preloadPromise = this.loadNextTrackBuffer(filePath, nextTrackInfo);
        try {
            return await this.preloadPromise;
        } finally {
            this.isPreloading = false;
            this.preloadPromise = null;
        }
    }

    // 加载下一首歌曲的音频缓冲区
    async loadNextTrackBuffer(filePath, trackInfo) {
        try {
            console.log(`🔄 预加载下一首歌曲: ${trackInfo.title || filePath}`);

            let arrayBuffer = await window.electronAPI.readAudioFile(filePath);
            this.nextAudioBuffer = await this.audioContext.decodeAudioData(arrayBuffer); // 解码

            // 清理arrayBuffer引用以释放内存
            arrayBuffer = null;
            this.nextTrackInfo = {
                ...trackInfo,
                filePath: filePath,
                duration: this.nextAudioBuffer.duration
            };

            console.log(`✅ 下一首歌曲预加载完成: ${trackInfo.title || filePath}`);
            return true;
        } catch (error) {
            console.error('❌ 预加载下一首歌曲失败:', error);
            this.clearNextTrackBuffer();
            return false;
        }
    }

    // 播放下一首
    async nextTrack(nextIndex = null) {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到下一首');
            return false;
        }

        // 在切换歌曲前，主动清理当前音频资源和预加载资源
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        // 停止当前播放，确保音频资源完全释放
        this.stop();

        // 切换到下一首：优先使用提供的nextIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (nextIndex !== null && nextIndex >= 0 && nextIndex < this.playlist.length) {
            this.currentIndex = nextIndex;
        } else if (typeof this.getNextTrackIndex === 'function') {
            this.currentIndex = this.getNextTrackIndex();
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        const nextTrack = this.playlist[this.currentIndex];

        // 获取文件路径，支持多种数据结构
        const filePath = nextTrack.filePath || nextTrack.path || nextTrack;

        if (!filePath) {
            console.error('❌ 下一首歌曲文件路径为空:', nextTrack);
            return false;
        }

        console.log(`⏭️ 切换到下一首 (索引 ${this.currentIndex}): ${nextTrack.title || filePath}`);

        // 若启用无间隙播放且已预加载，检查预加载的歌曲是否与当前要播放的歌曲一致
        const canUsePreloadedBuffer = this.gaplessPlaybackEnabled &&
            this.nextAudioBuffer &&
            this.nextTrackInfo &&
            this.nextTrackInfo.filePath === filePath;

        if (canUsePreloadedBuffer) {
            console.log('🎵 使用预加载的音频缓冲区进行无间隙播放');
            this.stop();
            this.audioBuffer = null;

            // 使用预加载的缓冲区
            this.audioBuffer = this.nextAudioBuffer;
            this.duration = this.nextTrackInfo.duration;
            this.currentTrack = this.nextTrackInfo;

            // 清理预加载的资源
            this.clearNextTrackBuffer();

            // 播放
            const playResult = await this.play();

            // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            // 预加载下一首
            // 无间隙播放模式下
            if (playResult && this.gaplessPlaybackEnabled) {
                setTimeout(() => this.preloadNextTrack(), 1000);
            }

            return playResult;
        } else {
            // 普通加载方式（预加载不可用或预加载的歌曲不匹配）
            if (this.nextAudioBuffer && this.nextTrackInfo && this.nextTrackInfo.filePath !== filePath) {
                console.log('⚠️ 预加载的歌曲与目标歌曲不一致，清理预加载缓冲区');
                this.clearNextTrackBuffer();
            }

            const loadResult = await this.loadTrack(filePath);
            if (loadResult) {
                // 播放
                const playResult = await this.play();

                // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
                if (playResult && this.onTrackChanged) {
                    this.onTrackChanged(this.currentTrack);
                }

                // 无间隙播放模式下预加载下一首歌曲
                if (playResult && this.gaplessPlaybackEnabled) {
                    setTimeout(() => this.preloadNextTrack(), 1000);
                }
                return playResult;
            }
            return false;
        }
    }

    // 播放上一首
    async previousTrack(prevIndex = null) {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到上一首');
            return false;
        }

        // 在切换歌曲前，主动清理当前音频资源和预加载资源
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        // 停止当前播放，确保音频资源完全释放
        this.stop();

        // 切换到上一首：优先使用提供的prevIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (prevIndex !== null && prevIndex >= 0 && prevIndex < this.playlist.length) {
            this.currentIndex = prevIndex;
        } else if (typeof this.getPreviousTrackIndex === 'function') {
            this.currentIndex = this.getPreviousTrackIndex();
        } else {
            this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        }
        const prevTrack = this.playlist[this.currentIndex];

        // 获取文件路径，支持多种数据结构
        const filePath = prevTrack.filePath || prevTrack.path || prevTrack;

        if (!filePath) {
            console.error('❌ 上一首歌曲文件路径为空:', prevTrack);
            return false;
        }

        console.log(`⏮️ 切换到上一首 (索引 ${this.currentIndex}): ${prevTrack.title || filePath}`);

        const loadResult = await this.loadTrack(filePath);
        if (loadResult) {
            // 自动开始播放
            const playResult = await this.play();

            // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            return playResult;
        }
        return false;
    }

    async getTrackMetadata(filePath) {
        // console.log('🔄 从主进程获取音频元数据...');
        const metadata = await window.electronAPI.library.getTrackMetadata(filePath);
        if (metadata) {
            // console.log(`✅ 成功获取元数据: ${metadata.title} - ${metadata.artist}`);
            return {
                title: metadata.title || '未知标题',
                artist: metadata.artist || '未知艺术家',
                album: metadata.album || '未知专辑',
                duration: metadata.duration || 0,
                bitrate: metadata.bitrate || 0,
                sampleRate: metadata.sampleRate || 0,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                cover: metadata.cover
            };
        }
    }

    // 歌曲播放结束处理
    onTrackEnded() {
        // console.log('🔚 歌曲播放结束');
        this.isPlaying = false;
        this.isPaused = false;

        // 自动播放下一首
        if (this.playlist.length > 0) {
            if (this.gaplessPlaybackEnabled) {
                // 无间隙播放
                setTimeout(async () => {
                    await this.nextTrack();
                }, 0);
            } else {
                // 普通播放
                setTimeout(async () => {
                    await this.nextTrack();
                }, 500);
            }
        }
    }

    // 开始进度更新定时器
    startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(async () => {
            if (this.isPlaying && this.onPositionChanged) {
                this.onPositionChanged(await this.getPosition());
            }
        }, 50);
    }

    // 停止进度更新定时器
    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    // 初始化均衡器
    initializeEqualizer() {
        if (!this.audioContext) {
            console.error('❌ 音频上下文未初始化，无法创建均衡器');
            return;
        }
        this.equalizer = new AudioEqualizer(this.audioContext);
    }

    // 获取均衡器实例
    getEqualizer() {
        return this.equalizer;
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled) {
        // 如果状态没有变化，直接返回
        if (this.equalizerEnabled === enabled) {
            // console.log(`ℹ️ 均衡器状态已经是 ${enabled}，无需更改`);
            return;
        }

        this.equalizerEnabled = enabled;

        // 如果音频正在播放且sourceNode存在，立即重新连接音频链
        if (this.sourceNode && this.isPlaying) {
            // console.log('🔄 音频正在播放，立即重新连接音频链以应用均衡器状态变化');
            this.reconnectAudioChain();
        }

        if (this.onEqualizerChanged) {
            this.onEqualizerChanged({enabled});
        }
    }

    // 连接音频源到音频链
    connectSourceToChain() {
        console.log('🔗 开始连接音频源到音频链...');
        if (!this.sourceNode) {
            console.warn('⚠️ sourceNode不存在，无法连接音频链');
            return;
        }

        // 确保gainNode连接到destination
        try {
            // 检查gainNode是否已连接到destination，如果没有则连接
            this.gainNode.disconnect();
            this.gainNode.connect(this.audioContext.destination);
            console.log('✅ gainNode -> destination 连接确保');
        } catch (error) {
            console.warn('⚠️ gainNode连接确保失败:', error);
        }

        if (this.equalizer && this.equalizerEnabled) {
            console.log('🔗 使用均衡器路径: sourceNode -> equalizer.input -> [滤波器链] -> equalizer.output -> gainNode -> destination');

            try {
                // 确保均衡器输出连接到gainNode
                this.equalizer.output.disconnect();
                this.equalizer.output.connect(this.gainNode);
                console.log('✅ equalizer.output -> gainNode 连接确保');

                // 音频源 -> 均衡器输入
                this.sourceNode.connect(this.equalizer.input);
                console.log('✅ sourceNode -> equalizer.input 连接成功');

            } catch (error) {
                console.error('❌ 均衡器音频链连接失败:', error);
                // 回退到直接连接
                try {
                    this.sourceNode.connect(this.gainNode);
                    console.log('🔄 回退到直接连接: sourceNode -> gainNode');
                } catch (fallbackError) {
                    console.error('❌ 回退连接也失败:', fallbackError);
                }
            }
        } else {
            console.log('🔗 使用直接路径: sourceNode -> gainNode -> destination');
            try {
                // 音频源 -> 增益节点
                this.sourceNode.connect(this.gainNode);
                console.log('✅ sourceNode -> gainNode 连接成功');
            } catch (error) {
                console.error('❌ 直接音频链连接失败:', error);
            }
        }
    }

    // 重新连接音频链 - 支持实时切换
    reconnectAudioChain() {
        console.log('🔄 开始重新连接音频链（实时切换模式）...');

        if (!this.audioContext || !this.gainNode) {
            console.warn('⚠️ audioContext或gainNode不存在，无法重新连接音频链');
            return false;
        }

        if (!this.sourceNode) {
            console.warn('⚠️ sourceNode不存在，无法重新连接音频链');
            return false;
        }

        console.log('🔄 断开所有现有连接...');

        // 只断开必要的连接，避免破坏基础连接
        try {
            if (this.sourceNode) {
                this.sourceNode.disconnect();
            }
        } catch (error) {
            console.warn('⚠️ sourceNode断开失败:', error);
        }

        try {
            if (this.equalizer && this.equalizer.output) {
                this.equalizer.output.disconnect();
            }
        } catch (error) {
            console.warn('⚠️ equalizer.output断开失败:', error);
        }

        // 断开gainNode的输入连接，但保持到destination的连接
        try {
            // 先断开所有连接，然后重新建立到destination的连接
            this.gainNode.disconnect();
            this.gainNode.connect(this.audioContext.destination);
        } catch (error) {
            console.warn('⚠️ gainNode重连失败:', error);
        }

        // 重新连接音频路径
        try {
            if (this.equalizer && this.equalizerEnabled) {
                console.log('🔗 使用均衡器路径: sourceNode -> equalizer -> gainNode -> destination');

                // 均衡器输出 -> 增益节点
                this.equalizer.output.connect(this.gainNode);
                console.log('✅ equalizer.output -> gainNode 重新连接成功');

                // 音频源 -> 均衡器输入
                this.sourceNode.connect(this.equalizer.input);
                console.log('✅ sourceNode -> equalizer.input 重新连接成功');

            } else {
                console.log('🔗 使用直接路径: sourceNode -> gainNode -> destination');

                // 音频源 -> 增益节点
                this.sourceNode.connect(this.gainNode);
                console.log('✅ sourceNode -> gainNode 直接重新连接成功');
            }
            return true;

        } catch (error) {
            console.error('❌ 音频链重新连接失败:', error);

            // 尝试恢复基本连接
            try {
                this.sourceNode.disconnect();
                this.sourceNode.connect(this.gainNode);
                return true;
            } catch (recoveryError) {
                console.error('❌ 恢复基本连接也失败:', recoveryError);
                return false;
            }
        }
    }

    // 初始化窗口可见性监听
    initVisibilityListener() {
        try {
            // 监听页面可见性变化
            document.addEventListener('visibilitychange', async () => {
                await this.handleVisibilityChange();
            });

            // 监听窗口焦点变化
            window.addEventListener('focus', async () => {
                this.isWindowVisible = true;
                await this.handleWindowVisible();
            });

            window.addEventListener('blur', () => {
                this.isWindowVisible = false;
                this.handleWindowHidden();
            });
        } catch (error) {
            console.error('❌ WebAudioEngine: 初始化窗口可见性监听失败:', error);
        }
    }

    // 处理窗口可见性变化
    async handleVisibilityChange() {
        if (document.hidden) {
            this.isWindowVisible = false;
            this.handleWindowHidden();
        } else {
            this.isWindowVisible = true;
            await this.handleWindowVisible();
        }
    }

    // 处理窗口隐藏（最小化或隐藏到托盘）
    handleWindowHidden() {
        this.scheduleMemoryCleanup();
    }

    // 处理窗口显示
    async handleWindowVisible() {
        this.cancelScheduledMemoryCleanup();
        await this.forceGarbageCollection();
    }

    // 调度内存清理
    scheduleMemoryCleanup() {
        // 取消之前的清理任务
        this.cancelScheduledMemoryCleanup();

        // 5秒后执行内存清理，给窗口恢复留出时间
        this.memoryCleanupTimer = setTimeout(async () => {
            await this.performMemoryCleanup();
        }, 5000);
    }

    // 取消调度的内存清理
    cancelScheduledMemoryCleanup() {
        if (this.memoryCleanupTimer) {
            clearTimeout(this.memoryCleanupTimer);
            this.memoryCleanupTimer = null;
        }
    }

    // 执行内存清理
    async performMemoryCleanup() {
        if (this.isWindowVisible) {
            return;
        }
        try {
            // 清理封面URL
            this.cleanupCoverUrls();

            // 强制垃圾回收
            await this.forceGarbageCollection();
        } catch (error) {
            console.error('❌ WebAudioEngine: 内存清理失败:', error);
        }
    }

    // 强制垃圾回收
    async forceGarbageCollection() {
        if (typeof window.gc === 'function') {
            window.gc();
        }
    }

    destroy() {
        this.stop();
        this.stopProgressTimer();

        // 取消内存清理任务
        this.cancelScheduledMemoryCleanup();

        // 清理封面URL
        this.cleanupCoverUrls();

        // 清理所有音频缓冲区
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        if (this.equalizer) {
            this.equalizer.destroy();
            this.equalizer = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        // 移除事件监听器
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('focus', this.handleWindowVisible);
        window.removeEventListener('blur', this.handleWindowHidden);
    }
}

// 音频均衡器类
class AudioEqualizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.filters = [];
        this.input = null;
        this.output = null;

        this.frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.presets = {
            'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'pop': [1, 2, 3, 1, -1, -1, 1, 2, 3, 2],
            'rock': [3, 2, 1, 0, -1, 0, 1, 2, 3, 3],
            'classical': [2, 1, 0, 0, 0, 0, -1, -1, 0, 1],
            'jazz': [2, 1, 0, 1, 2, 1, 0, 1, 2, 2],
            'vocal': [0, -1, -2, -1, 1, 3, 3, 2, 1, 0],
            'bass': [4, 3, 2, 1, 0, -1, -2, -2, -1, 0],
            'treble': [0, -1, -2, -1, 0, 1, 2, 3, 4, 4],
            'electronic': [2, 3, 1, 0, -1, 1, 0, 1, 2, 3]
        };

        // 当前增益值 (dB)
        this.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.initialize();
    }

    // 初始化均衡器
    initialize() {
        try {
            // 创建输入和输出节点
            this.input = this.audioContext.createGain();
            this.output = this.audioContext.createGain();

            // 创建滤波器链
            this.createFilterChain();
        } catch (error) {
            console.error('❌ 音频均衡器初始化失败:', error);
            throw error;
        }
    }

    // 创建滤波器链
    createFilterChain() {
        console.log(`🔗 频段数量: ${this.frequencies.length}`);

        let previousNode = this.input;
        console.log(`🔗 起始节点: input (${!!this.input})`);

        for (let i = 0; i < this.frequencies.length; i++) {
            // console.log(`🔗 创建第 ${i + 1} 个滤波器 (${this.frequencies[i]}Hz)...`);

            const filter = this.audioContext.createBiquadFilter();
            // 设置滤波器类型
            if (i === 0) {
                // 第一个频段使用低频搁架滤波器
                filter.type = 'lowshelf';
            } else if (i === this.frequencies.length - 1) {
                // 最后一个频段使用高频搁架滤波器
                filter.type = 'highshelf';
            } else {
                // 中间频段使用峰值滤波器
                filter.type = 'peaking';
            }

            // 设置频率
            filter.frequency.value = this.frequencies[i];

            // 设置Q值
            if (filter.type === 'peaking') {
                filter.Q.value = 1.0; // 峰值滤波器的Q值
            } else {
                filter.Q.value = 0.7; // 搁架滤波器的Q值
            }

            // 初始增益为0
            filter.gain.value = 0;
            // console.log(`🔗 滤波器 ${i} 初始增益: 0dB`);

            try {
                // 连接到链中
                previousNode.connect(filter);
                // console.log(`✅ 滤波器 ${i} 连接成功: ${previousNode === this.input ? 'input' : 'filter' + (i - 1)} -> filter${i}`);
                previousNode = filter;
            } catch (error) {
                console.error(`❌ 滤波器 ${i} 连接失败:`, error);
                throw error;
            }

            this.filters.push(filter);
        }

        try {
            // 连接到输出
            previousNode.connect(this.output);
            console.log(`✅ 最后一个滤波器连接到输出: filter${this.filters.length - 1} -> output`);
        } catch (error) {
            console.error('❌ 连接到输出失败:', error);
            throw error;
        }

        console.log(`🔗 滤波器链路径: input -> ${this.filters.length}个滤波器 -> output`);
    }

    // 设置频段增益
    setBandGain(bandIndex, gain) {
        if (bandIndex < 0 || bandIndex >= this.frequencies.length) {
            console.error('❌ 无效的频段索引:', bandIndex, '有效范围: 0-' + (this.frequencies.length - 1));
            return;
        }

        // 限制增益范围
        gain = Math.max(-12, Math.min(12, gain));
        this.gains[bandIndex] = gain;
        if (this.filters.length > 0 && this.filters[bandIndex]) {
            this.filters[bandIndex].gain.setValueAtTime(gain, this.audioContext.currentTime);
        } else {
            console.log(`⚠️ 频段 ${bandIndex} 滤波器不存在（可能处于绕过模式），仅更新增益记录`);
        }
    }

    // 获取频段增益
    getBandGain(bandIndex) {
        if (bandIndex < 0 || bandIndex >= this.gains.length) {
            return 0;
        }
        return this.gains[bandIndex];
    }

    // 设置所有频段增益
    setAllGains(gains) {
        if (!Array.isArray(gains) || gains.length !== this.frequencies.length) {
            console.error('❌ 无效的增益数组');
            return;
        }

        for (let i = 0; i < gains.length; i++) {
            this.setBandGain(i, gains[i]);
        }
    }

    // 获取所有频段增益
    getAllGains() {
        return [...this.gains];
    }

    // 应用预设
    applyPreset(presetName) {
        if (!this.presets[presetName]) {
            console.error('❌ 未知的预设:', presetName);
            return false;
        }
        this.setAllGains(this.presets[presetName]);
        return true;
    }

    // 获取可用预设列表
    getPresetNames() {
        return Object.keys(this.presets);
    }

    // 重置所有频段为平坦响应
    reset() {
        this.setAllGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }

    // 断开所有连接
    disconnect() {
        try {
            if (this.input) {
                this.input.disconnect();
            }
        } catch (error) {
            console.warn('⚠️ 均衡器input节点断开失败:', error);
        }

        try {
            if (this.output) {
                this.output.disconnect();
            }
        } catch (error) {
            console.warn('⚠️ 均衡器output节点断开失败:', error);
        }

        this.filters.forEach((filter, index) => {
            try {
                filter.disconnect();
            } catch (error) {
                console.warn(`⚠️ 滤波器 ${index} 断开失败:`, error);
            }
        });
    }

    destroy() {
        this.disconnect();
        this.filters = [];
        this.input = null;
        this.output = null;
    }
}

export {WebAudioEngine, AudioEqualizer};
