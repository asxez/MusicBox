/**
 * WebAudioEngine 变速不变调扩展
 * 为现有的 WebAudioEngine 添加变速不变调功能
 * 修复版本：正确处理变速播放时的进度计算和播放结束检测
 */

class WebAudioEngineExtensions {
    constructor(webAudioEngine) {
        this.engine = webAudioEngine;
        this.playbackRate = 1.0;
        this.pitchShifter = null;
        this.soundTouchEnabled = false;

        // 变速播放专用的时间管理
        this.pitchShifterStartTime = 0;
        this.pitchShifterStartOffset = 0;
        this.pitchShifterEndCheckTimer = null;

        // 内存管理：缓存和清理
        this.offsetAudioBufferCache = new Map(); // 缓存偏移音频缓冲区
        this.maxCacheSize = 3; // 最大缓存数量
        this.createdBuffers = new Set(); // 跟踪创建的缓冲区

        // 保存原始方法的引用
        this.originalPlay = this.engine.play.bind(this.engine);
        this.originalPause = this.engine.pause.bind(this.engine);
        this.originalStop = this.engine.stop.bind(this.engine);
        this.originalSeek = this.engine.seek.bind(this.engine);
        this.originalDestroy = this.engine.destroy.bind(this.engine);
        this.originalGetPosition = this.engine.getPosition.bind(this.engine);

        // 扩展引擎
        this.extendEngine();

        console.log('🎵 WebAudioEngine 变速不变调扩展已加载（修复版）');
    }

    /**
     * 扩展现有的 WebAudioEngine
     */
    extendEngine() {
        // 添加新属性
        this.engine.playbackRate = this.playbackRate;
        this.engine.pitchShifter = this.pitchShifter;
        this.engine.soundTouchEnabled = this.soundTouchEnabled;
        
        // 扩展方法
        this.engine.setPlaybackRate = this.setPlaybackRate.bind(this);
        this.engine.getPlaybackRate = this.getPlaybackRate.bind(this);
        this.engine.initializeSoundTouch = this.initializeSoundTouch.bind(this);
        this.engine.playWithPitchShifter = this.playWithPitchShifter.bind(this);
        this.engine.createOffsetAudioBuffer = this.createOffsetAudioBuffer.bind(this);

        // 重写核心方法
        this.engine.play = this.enhancedPlay.bind(this);
        this.engine.pause = this.enhancedPause.bind(this);
        this.engine.stop = this.enhancedStop.bind(this);
        this.engine.seek = this.enhancedSeek.bind(this);
        this.engine.destroy = this.enhancedDestroy.bind(this);
        this.engine.getPosition = this.enhancedGetPosition.bind(this);
        
        // 初始化SoundTouch
        this.initializeSoundTouch();
    }

    /**
     * 初始化SoundTouch
     */
    async initializeSoundTouch() {
        try {
            // 等待SoundTouchJS库加载
            let attempts = 0;
            while (!window.PitchShifter && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.PitchShifter) {
                console.warn('⚠️ SoundTouchJS库未加载，变速功能将不可用');
                return false;
            }

            console.log('✅ SoundTouchJS 库已加载');
            return true;
        } catch (error) {
            console.error('❌ SoundTouchJS 初始化失败:', error);
            return false;
        }
    }

    /**
     * 增强的播放方法
     */
    async enhancedPlay() {
        try {
            if (!this.engine.audioBuffer) {
                console.warn('⚠️ 没有加载音频文件');
                return false;
            }

            // 恢复音频上下文
            if (this.engine.audioContext.state === 'suspended') {
                await this.engine.audioContext.resume();
            }

            // 如果已经在播放且未暂停，不重复播放
            if (this.engine.isPlaying && !this.engine.isPaused) {
                console.log('⚠️ 音频已在播放中');
                return true;
            }

            console.log(`🔄 准备播放，播放速度: ${this.playbackRate}x`);

            // 停止当前播放
            this.cleanupAudioSources();

            // 根据播放速度选择播放方式
            if (this.playbackRate !== 1.0 && window.PitchShifter) {
                return await this.playWithPitchShifter();
            } else {
                return await this.playNormal();
            }
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    /**
     * 使用PitchShifter播放（修复版：正确处理进度计算和播放结束检测）
     */
    async playWithPitchShifter() {
        try {
            if (!window.PitchShifter) {
                console.warn('⚠️ PitchShifter不可用，回退到普通播放');
                return await this.playNormal();
            }

            // 获取播放偏移量（修复：确保正确获取偏移量）
            let offset = 0;
            if (this.engine.isPaused && this.engine.pauseTime > 0) {
                offset = this.engine.pauseTime;
            } else if (!this.engine.isPlaying && this.engine.pauseTime > 0) {
                // 处理seek后立即播放的情况
                offset = this.engine.pauseTime;
            }

            let validOffset = Math.max(0, Math.min(offset, this.engine.duration - 0.1));

            console.log(`🎵 PitchShifter偏移量计算: isPaused=${this.engine.isPaused}, pauseTime=${this.engine.pauseTime}, validOffset=${validOffset}`);

            console.log(`🎵 PitchShifter播放，偏移量: ${validOffset.toFixed(2)}s，播放速度: ${this.playbackRate}x`);

            // 清理之前的PitchShifter和定时器
            this.cleanupPitchShifterResources();

            // 如果需要从中间位置开始播放，创建截取的音频缓冲区
            let audioBuffer = this.engine.audioBuffer;
            if (validOffset > 0) {
                audioBuffer = this.createOffsetAudioBuffer(validOffset);
                if (!audioBuffer) {
                    console.warn('⚠️ 创建偏移音频缓冲区失败，从头开始播放');
                    audioBuffer = this.engine.audioBuffer;
                    // 如果创建失败，重置偏移量
                    validOffset = 0;
                }
            }

            // 创建PitchShifter实例
            const bufferSize = 4096;
            this.pitchShifter = new window.PitchShifter(
                this.engine.audioContext,
                audioBuffer,
                bufferSize
            );

            // 设置播放参数
            this.pitchShifter.tempo = this.playbackRate;
            this.pitchShifter.pitch = 1.0; // 保持音调不变

            // 连接到增益节点
            this.pitchShifter.connect(this.engine.gainNode);

            // 记录变速播放的时间管理信息
            this.pitchShifterStartTime = this.engine.audioContext.currentTime;
            this.pitchShifterStartOffset = validOffset;

            // 计算变速播放的实际结束时间
            const remainingDuration = this.engine.duration - validOffset;
            const actualPlayDuration = remainingDuration / this.playbackRate; // 变速播放的实际时长

            console.log(`🎵 变速播放时间计算: 剩余时长=${remainingDuration.toFixed(2)}s, 实际播放时长=${actualPlayDuration.toFixed(2)}s`);

            // 设置播放结束检测定时器
            this.pitchShifterEndCheckTimer = setTimeout(() => {
                this.handlePitchShifterPlaybackEnd();
            }, (actualPlayDuration + 0.1) * 1000); // 稍微延迟一点确保播放完成

            this.soundTouchEnabled = true;
            this.engine.soundTouchEnabled = true;
            this.engine.isPlaying = true;
            this.engine.isPaused = false;

            // 开始进度更新
            this.engine.startProgressTimer();

            console.log(`✅ PitchShifter播放成功启动，预计${actualPlayDuration.toFixed(2)}秒后结束`);

            // 触发事件
            if (this.engine.onPlaybackStateChanged) {
                this.engine.onPlaybackStateChanged(true);
            }

            return true;
        } catch (error) {
            console.error('❌ PitchShifter播放失败:', error);
            return await this.playNormal();
        }
    }

    /**
     * 处理PitchShifter播放结束
     */
    handlePitchShifterPlaybackEnd() {
        console.log('🔚 PitchShifter播放结束');

        // 清理资源
        this.cleanupPitchShifterResources();

        // 设置状态
        this.engine.isPlaying = false;
        this.engine.isPaused = false;
        this.soundTouchEnabled = false;
        this.engine.soundTouchEnabled = false;

        // 停止进度更新
        this.engine.stopProgressTimer();

        // 触发播放结束事件
        if (this.engine.onTrackEnded) {
            this.engine.onTrackEnded();
        }

        // 触发播放状态变化事件
        if (this.engine.onPlaybackStateChanged) {
            this.engine.onPlaybackStateChanged(false);
        }

        // 触发位置更新事件（设置为音频结束位置）
        if (this.engine.onPositionChanged) {
            this.engine.onPositionChanged(this.engine.duration);
        }
    }

    /**
     * 清理PitchShifter相关资源（增强版：完全内存清理）
     */
    cleanupPitchShifterResources() {
        // 清理PitchShifter
        if (this.pitchShifter) {
            try {
                // 断开所有连接
                this.pitchShifter.disconnect();

                // 如果PitchShifter有清理方法，调用它
                if (typeof this.pitchShifter.destroy === 'function') {
                    this.pitchShifter.destroy();
                }
                if (typeof this.pitchShifter.cleanup === 'function') {
                    this.pitchShifter.cleanup();
                }
            } catch (e) {
                console.warn('⚠️ PitchShifter清理时出现错误:', e);
            }
            this.pitchShifter = null;
            this.engine.pitchShifter = null;
        }

        // 清理播放结束检测定时器
        if (this.pitchShifterEndCheckTimer) {
            clearTimeout(this.pitchShifterEndCheckTimer);
            this.pitchShifterEndCheckTimer = null;
        }

        // 重置时间管理变量
        this.pitchShifterStartTime = 0;
        this.pitchShifterStartOffset = 0;

        console.log('🗑️ PitchShifter资源清理完成');
    }

    /**
     * 普通播放方法
     */
    async playNormal() {
        // 获取播放偏移量（修复：确保正确获取偏移量）
        let offset = 0;
        if (this.engine.isPaused && this.engine.pauseTime > 0) {
            offset = this.engine.pauseTime;
        } else if (!this.engine.isPlaying && this.engine.pauseTime > 0) {
            // 处理seek后立即播放的情况
            offset = this.engine.pauseTime;
        }

        const validOffset = Math.max(0, Math.min(offset, this.engine.duration - 0.1));

        console.log(`🎵 普通播放偏移量计算: isPaused=${this.engine.isPaused}, pauseTime=${this.engine.pauseTime}, validOffset=${validOffset.toFixed(2)}s`);

        // 创建音频源
        this.engine.sourceNode = this.engine.audioContext.createBufferSource();
        this.engine.sourceNode.buffer = this.engine.audioBuffer;
        this.engine.sourceNode.connect(this.engine.gainNode);

        // 设置播放结束回调
        this.engine.sourceNode.onended = () => {
            if (this.engine.isPlaying) {
                this.engine.onTrackEnded();
            }
        };

        try {
            this.engine.sourceNode.start(0, validOffset);
            this.engine.startTime = this.engine.audioContext.currentTime - validOffset;

            this.engine.isPlaying = true;
            this.engine.isPaused = false;
            this.soundTouchEnabled = false;
            this.engine.soundTouchEnabled = false;

            // 开始进度更新
            this.engine.startProgressTimer();

            console.log(`✅ 普通播放成功启动`);

            // 触发事件
            if (this.engine.onPlaybackStateChanged) {
                this.engine.onPlaybackStateChanged(true);
            }

            return true;
        } catch (error) {
            console.error('❌ 普通播放失败:', error);
            return false;
        }
    }

    /**
     * 创建从指定偏移量开始的音频缓冲区（带缓存和内存管理）
     */
    createOffsetAudioBuffer(offsetSeconds) {
        try {
            const sampleRate = this.engine.audioBuffer.sampleRate;
            const offsetSamples = Math.floor(offsetSeconds * sampleRate);
            const remainingSamples = this.engine.audioBuffer.length - offsetSamples;

            if (remainingSamples <= 0) {
                console.warn('⚠️ 偏移量超出音频长度');
                return null;
            }

            // 生成缓存键（基于偏移量和原始缓冲区）
            const cacheKey = `${this.engine.audioBuffer.length}_${offsetSamples}_${remainingSamples}`;

            // 检查缓存
            if (this.offsetAudioBufferCache.has(cacheKey)) {
                console.log(`🔄 使用缓存的偏移音频缓冲区: ${offsetSeconds.toFixed(2)}s`);
                return this.offsetAudioBufferCache.get(cacheKey);
            }

            // 清理缓存（如果超过最大数量）
            if (this.offsetAudioBufferCache.size >= this.maxCacheSize) {
                this.clearOldestCacheEntry();
            }

            // 创建新的音频缓冲区
            const newBuffer = this.engine.audioContext.createBuffer(
                this.engine.audioBuffer.numberOfChannels,
                remainingSamples,
                sampleRate
            );

            // 复制音频数据
            for (let channel = 0; channel < this.engine.audioBuffer.numberOfChannels; channel++) {
                const originalData = this.engine.audioBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);

                for (let i = 0; i < remainingSamples; i++) {
                    newData[i] = originalData[offsetSamples + i];
                }
            }

            // 添加到缓存和跟踪集合
            this.offsetAudioBufferCache.set(cacheKey, newBuffer);
            this.createdBuffers.add(newBuffer);

            console.log(`✅ 创建并缓存偏移音频缓冲区: ${offsetSeconds.toFixed(2)}s (缓存大小: ${this.offsetAudioBufferCache.size})`);
            return newBuffer;
        } catch (error) {
            console.error('❌ 创建偏移音频缓冲区失败:', error);
            return null;
        }
    }

    /**
     * 清理最旧的缓存条目
     */
    clearOldestCacheEntry() {
        const firstKey = this.offsetAudioBufferCache.keys().next().value;
        if (firstKey) {
            const buffer = this.offsetAudioBufferCache.get(firstKey);
            this.offsetAudioBufferCache.delete(firstKey);
            this.createdBuffers.delete(buffer);
            console.log(`🗑️ 清理最旧的缓存条目: ${firstKey}`);
        }
    }

    /**
     * 清理所有缓存的音频缓冲区
     */
    clearAllAudioBufferCache() {
        console.log(`🗑️ 清理所有音频缓冲区缓存 (${this.offsetAudioBufferCache.size} 个)`);
        this.offsetAudioBufferCache.clear();
        this.createdBuffers.clear();
    }

    /**
     * 清理音频源
     */
    cleanupAudioSources() {
        // 清理普通音频源
        if (this.engine.sourceNode) {
            try {
                this.engine.sourceNode.onended = null;
                this.engine.sourceNode.stop();
                this.engine.sourceNode.disconnect();
            } catch (e) {
                // 忽略错误
            }
            this.engine.sourceNode = null;
        }

        // 清理PitchShifter相关资源
        this.cleanupPitchShifterResources();
    }

    /**
     * 增强的暂停方法
     */
    enhancedPause() {
        try {
            if (!this.engine.isPlaying && !this.engine.sourceNode && !this.pitchShifter) {
                console.log('⚠️ 音频未在播放，无法暂停');
                return false;
            }

            // 记录暂停位置
            let currentPosition;
            if (this.engine.startTime > 0) {
                currentPosition = this.engine.audioContext.currentTime - this.engine.startTime;
            } else {
                currentPosition = this.engine.getPosition();
            }

            this.engine.pauseTime = Math.max(0, Math.min(currentPosition, this.engine.duration - 0.1));

            console.log(`⏸️ 暂停播放，位置: ${this.engine.pauseTime.toFixed(2)}s`);

            // 清理音频源
            this.cleanupAudioSources();

            this.engine.isPlaying = false;
            this.engine.isPaused = true;
            this.soundTouchEnabled = false;
            this.engine.soundTouchEnabled = false;

            // 停止进度更新
            this.engine.stopProgressTimer();

            // 触发事件
            if (this.engine.onPlaybackStateChanged) {
                this.engine.onPlaybackStateChanged(false);
            }

            // 立即触发位置更新事件
            if (this.engine.onPositionChanged) {
                this.engine.onPositionChanged(this.engine.pauseTime);
            }

            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    /**
     * 增强的停止方法
     */
    enhancedStop() {
        try {
            // 清理音频源
            this.cleanupAudioSources();

            this.engine.isPlaying = false;
            this.engine.isPaused = false;
            this.engine.startTime = 0;
            this.engine.pauseTime = 0;
            this.soundTouchEnabled = false;
            this.engine.soundTouchEnabled = false;

            // 停止进度更新
            this.engine.stopProgressTimer();

            console.log('⏹️ 停止播放');

            // 触发事件
            if (this.engine.onPlaybackStateChanged) {
                this.engine.onPlaybackStateChanged(false);
            }

            if (this.engine.onPositionChanged) {
                this.engine.onPositionChanged(0);
            }

            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    /**
     * 增强的跳转方法
     */
    async enhancedSeek(position) {
        try {
            if (!this.engine.audioBuffer) {
                console.warn('⚠️ 没有加载音频文件，无法跳转');
                return false;
            }

            const wasPlaying = this.engine.isPlaying;
            const targetPosition = Math.max(0, Math.min(position, this.engine.duration));

            console.log(`⏭️ 跳转到: ${targetPosition.toFixed(2)}s，当前播放状态: ${wasPlaying}`);

            // 清理音频源
            this.cleanupAudioSources();

            // 停止进度更新
            this.engine.stopProgressTimer();

            // 设置新位置
            this.engine.pauseTime = targetPosition;
            this.engine.isPaused = true;
            this.engine.isPlaying = false;

            // 如果之前在播放，从新位置继续播放
            if (wasPlaying) {
                console.log(`🔄 从位置 ${targetPosition.toFixed(2)}s 恢复播放`);
                await this.enhancedPlay();
            } else {
                console.log(`🔄 跳转到位置 ${targetPosition.toFixed(2)}s，保持暂停状态`);
            }

            // 触发位置更新事件
            if (this.engine.onPositionChanged) {
                this.engine.onPositionChanged(this.engine.pauseTime);
            }

            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    /**
     * 增强的销毁方法（完全内存清理）
     */
    enhancedDestroy() {
        console.log('🗑️ 开始销毁WebAudioEngine扩展...');

        // 清理音频源
        this.cleanupAudioSources();

        // 清理所有缓存的音频缓冲区
        this.clearAllAudioBufferCache();

        // 清理所有引用
        this.engine = null;
        this.pitchShifter = null;
        this.offsetAudioBufferCache = null;
        this.createdBuffers = null;

        // 清理原始方法引用
        this.originalPlay = null;
        this.originalPause = null;
        this.originalStop = null;
        this.originalSeek = null;
        this.originalDestroy = null;
        this.originalGetPosition = null;

        // 调用原始销毁方法
        if (this.originalDestroy) {
            this.originalDestroy();
        }

        console.log('🗑️ WebAudioEngine 扩展已完全销毁');
    }

    /**
     * 设置播放速度（内存安全版本）
     */
    setPlaybackRate(rate) {
        const newRate = Math.max(0.25, Math.min(4.0, rate));

        if (this.playbackRate === newRate) {
            return;
        }

        console.log(`🔄 切换播放速度: ${this.playbackRate}x -> ${newRate}x`);

        const wasPlaying = this.engine.isPlaying;
        const currentPosition = this.engine.getPosition();

        // 立即清理当前的PitchShifter资源
        this.cleanupPitchShifterResources();

        this.playbackRate = newRate;
        this.engine.playbackRate = newRate;

        // 如果正在播放，需要重新播放
        if (wasPlaying) {
            try {
                // 停止当前播放（这会清理更多资源）
                this.enhancedStop();

                // 设置位置
                this.engine.pauseTime = currentPosition;
                this.engine.isPaused = true;

                // 强制垃圾回收提示（如果可用）
                if (window.gc) {
                    window.gc();
                }

                // 重新开始播放
                setTimeout(async () => {
                    await this.enhancedPlay();
                }, 100); // 增加延迟确保资源清理完成
            } catch (error) {
                console.error('❌ 动态切换播放速度失败:', error);
            }
        }

        // 触发事件
        if (this.engine.onPlaybackRateChanged) {
            this.engine.onPlaybackRateChanged(newRate);
        }

        console.log(`✅ 播放速度切换完成: ${newRate}x`);
    }

    /**
     * 增强的获取播放位置方法（修复版：正确处理变速播放的进度计算）
     */
    enhancedGetPosition() {
        if (!this.engine.isPlaying && !this.engine.isPaused) {
            return 0;
        }

        if (this.engine.isPaused) {
            return this.engine.pauseTime;
        }

        // 如果使用PitchShifter进行变速播放
        if (this.soundTouchEnabled && this.pitchShifterStartTime > 0) {
            // 计算实际播放时间（考虑播放速度）
            const realTimeElapsed = this.engine.audioContext.currentTime - this.pitchShifterStartTime;
            const audioTimeElapsed = realTimeElapsed * this.playbackRate;
            const currentPosition = this.pitchShifterStartOffset + audioTimeElapsed;

            // 确保位置不超过音频总时长
            const clampedPosition = Math.max(0, Math.min(currentPosition, this.engine.duration));

            // 调试日志（可选）
            if (Math.random() < 0.1) { // 只偶尔打印，避免日志过多
                console.log(`🎵 变速播放位置计算: 实际时间=${realTimeElapsed.toFixed(2)}s, 音频时间=${audioTimeElapsed.toFixed(2)}s, 当前位置=${clampedPosition.toFixed(2)}s`);
            }

            return clampedPosition;
        }

        // 普通播放模式，使用原始方法
        if (!this.engine.audioContext || this.engine.startTime <= 0) {
            return this.engine.pauseTime || 0;
        }

        const currentPosition = this.engine.audioContext.currentTime - this.engine.startTime;
        return Math.max(0, Math.min(currentPosition, this.engine.duration));
    }

    /**
     * 获取当前播放速度
     */
    getPlaybackRate() {
        return this.playbackRate;
    }
}

// 导出扩展类
window.WebAudioEngineExtensions = WebAudioEngineExtensions;
