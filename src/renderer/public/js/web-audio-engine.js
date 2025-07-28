
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

        // 事件回调
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;

        // 进度更新定时器
        this.progressTimer = null;

        console.log('🎵 Web Audio Engine 初始化');
    }

    /**
     * 初始化音频上下文
     */
    async initialize() {
        try {
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // 创建增益节点用于音量控制
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;

            console.log('✅ Web Audio Engine 初始化成功');
            return true;
        } catch (error) {
            console.error('❌ Web Audio Engine 初始化失败:', error);
            return false;
        }
    }

    /**
     * 加载音频文件
     */
    async loadTrack(filePath) {
        try {
            console.log(`🔄 加载音频文件: ${filePath}`);
            this.stop();

            // 读取文件
            let arrayBuffer;
            if (window.electronAPI && window.electronAPI.readAudioFile) {
                // 使用Electron API读取文件
                console.log('🔄 使用Electron API读取文件');
                arrayBuffer = await window.electronAPI.readAudioFile(filePath);
            } else {
                // 回退到fetch方式
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

            // 获取元数据信息
            const metadata = await this.getTrackMetadata(filePath);

            // 优先使用元数据中的时长，如果没有则使用Web Audio API的时长
            this.duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : webAudioDuration;

            // 更新当前曲目信息
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
                cover: metadata.cover
            };

            console.log(`✅ 音频解码成功: Web Audio时长 ${webAudioDuration.toFixed(2)}s, 元数据时长 ${metadata.duration || 0}s`);
            console.log(`✅ 使用时长: ${this.duration.toFixed(2)}s`);
            console.log(`✅ 音频文件加载成功: ${this.currentTrack.title}`);
            if (this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }
            if (this.onDurationChanged) {
                this.onDurationChanged(filePath, this.duration);
            }
            return true;
        } catch (error) {
            console.error('❌ 音频文件加载失败:', error);
            return false;
        }
    }

    /**
     * 播放音频
     */
    async play() {
        try {
            if (!this.audioBuffer) {
                console.warn('⚠️ 没有加载音频文件');
                return false;
            }

            // 恢复音频上下文（用户交互后需要）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 如果已经在播放且未暂停，不重复播放
            if (this.isPlaying && !this.isPaused) {
                console.log('⚠️ 音频已在播放中');
                return true;
            }

            console.log(`🔄 准备播放，当前状态: isPlaying=${this.isPlaying}, isPaused=${this.isPaused}, pauseTime=${this.pauseTime}`);

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
            this.sourceNode.connect(this.gainNode);

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
                    console.log(`🔄 偏移量已调整为: ${validOffset.toFixed(2)}s`);
                }
            } catch (startError) {
                console.error('❌ 音频源启动失败:', startError);
                console.log('🔄 尝试从头开始播放');

                // 重新创建音频源并从头开始
                this.sourceNode = this.audioContext.createBufferSource();
                this.sourceNode.buffer = this.audioBuffer;
                this.sourceNode.connect(this.gainNode);
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

            this.startProgressTimer();
            console.log('✅ 播放成功启动');
            if (this.onPlaybackStateChanged) {
                console.log('🔄 Web Audio Engine: 触发播放状态变化事件');
                this.onPlaybackStateChanged(true);
            } else {
                console.warn('⚠️ Web Audio Engine: onPlaybackStateChanged 回调未设置');
            }

            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    /**
     * 暂停播放
     */
    pause() {
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
                const fallbackPosition = this.getPosition();
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
                    // 忽略已停止的错误
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = true;

            this.stopProgressTimer();
            console.log(`⏸️ 暂停播放，位置: ${this.pauseTime.toFixed(2)}s`);
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

    /**
     * 停止播放
     */
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
                    // 忽略已停止的错误
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = false;
            this.startTime = 0;
            this.pauseTime = 0;

            this.stopProgressTimer();
            console.log('⏹️ 停止播放');

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }
            if (this.onPositionChanged) {
                this.onPositionChanged(0);
            }

            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    /**
     * 跳转到指定位置
     */
    async seek(position) {
        try {
            if (!this.audioBuffer) {
                console.warn('⚠️ 没有加载音频文件，无法跳转');
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
                    // 忽略已停止的错误
                }
                this.sourceNode = null;
            }

            this.stopProgressTimer();

            // 设置新位置
            this.pauseTime = Math.max(0, Math.min(position, this.duration));
            this.isPaused = true;
            this.isPlaying = false;

            console.log(`⏭️ 跳转到: ${position.toFixed(2)}s`);
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

    /**
     * 设置音量
     */
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

    /**
     * 获取当前音量
     */
    getVolume() {
        return this.volume;
    }

    /**
     * 获取当前播放位置
     */
    getPosition() {
        if (!this.isPlaying && !this.isPaused) {
            return 0;
        }

        if (this.isPaused) {
            return this.pauseTime;
        }

        return this.audioContext.currentTime - this.startTime;
    }

    /**
     * 获取音频时长
     */
    getDuration() {
        return this.duration;
    }

    /**
     * 获取当前曲目信息
     */
    getCurrentTrack() {
        return this.currentTrack;
    }

    /**
     * 设置播放列表
     */
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

    /**
     * 播放下一首
     */
    async nextTrack() {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到下一首');
            return false;
        }

        // 切换到下一首
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextTrack = this.playlist[this.currentIndex];

        // 获取文件路径，支持多种数据结构
        const filePath = nextTrack.filePath || nextTrack.path || nextTrack;

        if (!filePath) {
            console.error('❌ 下一首歌曲文件路径为空:', nextTrack);
            return false;
        }

        console.log(`⏭️ 切换到下一首 (索引 ${this.currentIndex}): ${nextTrack.title || filePath}`);

        const loadResult = await this.loadTrack(filePath);
        if (loadResult) {
            // 自动开始播放
            return await this.play();
        }
        return false;
    }

    /**
     * 播放上一首
     */
    async previousTrack() {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到上一首');
            return false;
        }

        // 切换到上一首
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
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
            return await this.play();
        }
        return false;
    }

    /**
     * 从文件路径提取标题
     */
    extractTitleFromPath(filePath) {
        const fileName = filePath.split(/[/\\]/).pop();
        return fileName.replace(/\.[^/.]+$/, ''); // 移除扩展名
    }

    async getTrackMetadata(filePath) {
        try {
            // 优先从API获取完整的元数据
            if (window.electronAPI && window.electronAPI.library) {
                console.log('🔄 从主进程获取音频元数据...');
                const metadata = await window.electronAPI.library.getTrackMetadata(filePath);
                if (metadata) {
                    console.log(`✅ 成功获取元数据: ${metadata.title} - ${metadata.artist}`);
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
        } catch (error) {
            console.warn('⚠️ 无法从主进程获取元数据，使用文件名解析:', error);
        }

        // 回退到本地文件名解析
        console.log('🔄 使用文件名解析元数据...');
        const fileName = this.extractTitleFromPath(filePath);
        let artist = '未知艺术家';
        let title = fileName;
        let album = '未知专辑';

        // 检查是否包含分隔符
        const separators = [' - ', ' – ', ' — ', '-'];
        for (const sep of separators) {
            if (fileName.includes(sep)) {
                const parts = fileName.split(sep);
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts.slice(1).join(sep).trim();
                    break;
                }
            }
        }

        return {
            title,
            artist,
            album,
            duration: 0,
            bitrate: 0,
            sampleRate: 0,
            year: null,
            genre: null,
            track: null,
            disc: null,
            cover: null
        };
    }

    /**
     * 曲目播放结束处理
     */
    onTrackEnded() {
        console.log('🔚 曲目播放结束');
        this.isPlaying = false;
        this.isPaused = false;

        // 自动播放下一首（nextTrack方法内部已经调用了play，不需要重复调用）
        if (this.playlist.length > 0) {
            setTimeout(() => {
                this.nextTrack();
            }, 500);
        }
    }

    /**
     * 开始进度更新定时器
     */
    startProgressTimer() {
        this.stopProgressTimer();

        this.progressTimer = setInterval(() => {
            if (this.isPlaying && this.onPositionChanged) {
                this.onPositionChanged(this.getPosition());
            }
        }, 1000);
    }

    /**
     * 停止进度更新定时器
     */
    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    /**
     * 销毁音频引擎
     */
    destroy() {
        this.stop();
        this.stopProgressTimer();

        if (this.audioContext) {
            this.audioContext.close();
        }

        console.log('🗑️ Web Audio Engine 已销毁');
    }
}

// 导出音频引擎
window.WebAudioEngine = WebAudioEngine;
