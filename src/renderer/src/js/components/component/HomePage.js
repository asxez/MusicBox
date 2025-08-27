/**
 * 首页组件
 */

class HomePage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.setupElements();
    }

    async show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await api.getTracks();
        this.render();
    }

    hide() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy() {
        return super.destroy();
    }

    setupElements() {
        this.container = this.element;
    }

    // 沉浸式功能事件监听器
    setupImmersiveEventListeners() {
        // 可视化控制按钮
        const toggleVisualizerBtn = this.container.querySelector('#toggle-visualizer');
        if (toggleVisualizerBtn) {
            toggleVisualizerBtn.addEventListener('click', () => {
                this.toggleAudioVisualizer();
            });
        }

        const toggleBreathingBtn = this.container.querySelector('#toggle-breathing');
        if (toggleBreathingBtn) {
            toggleBreathingBtn.addEventListener('click', () => {
                this.toggleBreathingGuide();
            });
        }

        const toggleAmbientBtn = this.container.querySelector('#toggle-ambient');
        if (toggleAmbientBtn) {
            toggleAmbientBtn.addEventListener('click', () => {
                this.toggleAmbientMode();
            });
        }

        // 专注模式按钮
        const focusBtn = this.container.querySelector('.focus-btn');
        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                this.toggleFocusMode();
            });
        }

        // 心情记录按钮
        this.container.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mood = btn.dataset.mood;
                this.recordMood(mood);
                btn.classList.add('selected');
                setTimeout(() => btn.classList.remove('selected'), 1000);
            });
        });

        // 音乐日记保存按钮
        const saveDiaryBtn = this.container.querySelector('.save-diary-btn');
        if (saveDiaryBtn) {
            saveDiaryBtn.addEventListener('click', () => {
                this.saveMusicDiary();
            });
        }
    }

    // 沉浸式功能实现方法
    toggleAudioVisualizer() {
        const visualizer = this.container.querySelector('#audio-visualizer');
        const breathingGuide = this.container.querySelector('.breathing-guide');
        const breathingCircle = this.container.querySelector('#breathing-circle');

        if (!visualizer) return;

        const isActive = visualizer.classList.contains('active');
        if (isActive) {
            // 关闭音频可视化，显示呼吸引导
            visualizer.classList.remove('active');
            this.stopAudioVisualization();

            if (breathingGuide && breathingCircle) {
                breathingGuide.style.display = 'flex';
                breathingCircle.classList.add('active');
                this.startBreathingGuide();
            }
        } else {
            // 开启音频可视化，隐藏呼吸引导
            visualizer.classList.add('active');
            this.startAudioVisualization();

            if (breathingGuide && breathingCircle) {
                breathingGuide.style.display = 'none';
                breathingCircle.classList.remove('active');
                this.stopBreathingGuide();
            }
        }
    }

    startAudioVisualization() {
        // todo 改高级实现
        // 简单的音频可视化实现
        const canvas = this.container.querySelector('#audio-visualizer');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // 创建简单的波形动画
        let animationId;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制动态波形
            const time = Date.now() * 0.002;
            const centerY = canvas.height / 2;

            ctx.strokeStyle = 'rgba(51, 94, 234, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let x = 0; x < canvas.width; x += 2) {
                const y = centerY + Math.sin(x * 0.02 + time) * 20 +
                    Math.sin(x * 0.01 + time * 1.5) * 10;
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            animationId = requestAnimationFrame(animate);
        };

        this.visualizationAnimation = animationId;
        animate();
    }

    stopAudioVisualization() {
        if (this.visualizationAnimation) {
            cancelAnimationFrame(this.visualizationAnimation);
            this.visualizationAnimation = null;
        }
    }

    toggleBreathingGuide() {
        const breathingGuide = this.container.querySelector('.breathing-guide');
        const breathingCircle = this.container.querySelector('#breathing-circle');
        const visualizer = this.container.querySelector('#audio-visualizer');

        if (!breathingGuide || !breathingCircle) return;

        const isActive = breathingCircle.classList.contains('active');
        if (isActive) {
            // 关闭呼吸引导，显示音频可视化
            breathingCircle.classList.remove('active');
            breathingGuide.style.display = 'none';
            this.stopBreathingGuide();

            if (visualizer) {
                visualizer.classList.add('active');
                this.startAudioVisualization();
            }
        } else {
            // 开启呼吸引导，隐藏音频可视化
            breathingCircle.classList.add('active');
            breathingGuide.style.display = 'flex';
            this.startBreathingGuide();

            if (visualizer) {
                visualizer.classList.remove('active');
                this.stopAudioVisualization();
            }
        }
    }

    startBreathingGuide() {
        const breathingCircle = this.container.querySelector('#breathing-circle');
        const breathingText = breathingCircle?.querySelector('.breathing-text');
        if (!breathingCircle || !breathingText) return;

        let phase = 'inhale'; // inhale, hold, exhale
        let count = 0;

        const updateBreathing = () => {
            switch (phase) {
                case 'inhale':
                    breathingText.textContent = '吸气';
                    breathingCircle.style.transform = 'scale(1.3)';
                    if (count >= 4) {
                        phase = 'hold';
                        count = 0;
                    }
                    break;
                case 'hold':
                    breathingText.textContent = '屏息';
                    if (count >= 2) {
                        phase = 'exhale';
                        count = 0;
                    }
                    break;
                case 'exhale':
                    breathingText.textContent = '呼气';
                    breathingCircle.style.transform = 'scale(1)';
                    if (count >= 4) {
                        phase = 'inhale';
                        count = 0;
                    }
                    break;
            }
            count++;
        };

        this.breathingInterval = setInterval(updateBreathing, 1000);
        updateBreathing();
    }

    stopBreathingGuide() {
        if (this.breathingInterval) {
            clearInterval(this.breathingInterval);
            this.breathingInterval = null;
        }

        const breathingCircle = this.container.querySelector('#breathing-circle');
        const breathingText = breathingCircle?.querySelector('.breathing-text');
        if (breathingCircle && breathingText) {
            breathingCircle.style.transform = 'scale(1)';
            breathingText.textContent = '深呼吸';
        }
    }

    toggleAmbientMode() {
        const ambientOverlay = this.container.querySelector('#ambient-overlay');
        if (!ambientOverlay) return;

        const isActive = ambientOverlay.classList.contains('active');
        if (isActive) {
            ambientOverlay.classList.remove('active');
        } else {
            ambientOverlay.classList.add('active');
            this.updateAmbientMode();
        }
    }

    updateAmbientMode() {
        const hour = new Date().getHours();
        const ambientOverlay = this.container.querySelector('#ambient-overlay');
        if (!ambientOverlay) return;

        let gradient;
        if (hour >= 6 && hour < 12) {
            // 早晨 - 温暖的金色
            gradient = 'linear-gradient(45deg, rgba(255, 193, 7, 0.1), rgba(255, 152, 0, 0.05))';
        } else if (hour >= 12 && hour < 18) {
            // 下午 - 明亮的蓝色
            gradient = 'linear-gradient(45deg, rgba(33, 150, 243, 0.1), rgba(3, 169, 244, 0.05))';
        } else if (hour >= 18 && hour < 22) {
            // 傍晚 - 温暖的橙色
            gradient = 'linear-gradient(45deg, rgba(255, 87, 34, 0.1), rgba(255, 152, 0, 0.05))';
        } else {
            // 夜晚 - 深蓝紫色
            gradient = 'linear-gradient(45deg, rgba(63, 81, 181, 0.1), rgba(103, 58, 183, 0.05))';
        }
        ambientOverlay.style.background = gradient;
    }

    toggleFocusMode() {
        const isInFocusMode = document.body.classList.contains('focus-mode');
        if (isInFocusMode) {
            this.exitFocusMode();
        } else {
            this.enterFocusMode();
        }
    }

    enterFocusMode() {
        // 进入专注模式
        document.body.classList.add('focus-mode');

        // 启动所有沉浸式功能
        this.toggleAudioVisualizer();
        this.toggleBreathingGuide();
        this.toggleAmbientMode();

        // 更新按钮状态
        this.updateFocusModeButton(true);

        // 显示专注模式提示
        this.showFocusModeNotification();
    }

    showFocusModeNotification() {
        // 移除已存在的通知
        const existingNotification = document.querySelector('.focus-mode-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'focus-mode-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>专注模式已开启</h3>
                <p>享受沉浸式音乐体验，点击下方按钮或首页按钮可退出专注模式</p>
                <div class="notification-actions">
                    <button class="exit-focus-btn">退出专注模式</button>
                    <button class="minimize-notification-btn">我知道了</button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // 退出专注模式按钮
        notification.querySelector('.exit-focus-btn').addEventListener('click', () => {
            this.exitFocusMode();
        });

        // 最小化通知按钮
        notification.querySelector('.minimize-notification-btn').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translate(-50%, -50%) scale(0.8)';
            setTimeout(() => notification.remove(), 300);
        });

        // 5秒后自动最小化通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translate(-50%, -50%) scale(0.8)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    exitFocusMode() {
        // 退出专注模式
        document.body.classList.remove('focus-mode');

        // 更新按钮状态
        this.updateFocusModeButton(false);

        // 移除专注模式通知（如果存在）
        const notification = document.querySelector('.focus-mode-notification');
        if (notification) {
            notification.remove();
        }
    }

    updateFocusModeButton(isInFocusMode) {
        const focusBtn = this.container.querySelector('.focus-btn');
        if (!focusBtn) return;

        if (isInFocusMode) {
            focusBtn.textContent = '退出专注模式';
            focusBtn.classList.add('focus-mode-active');
        } else {
            focusBtn.textContent = '开始专注';
            focusBtn.classList.remove('focus-mode-active');
        }
    }

    recordMood(mood) {
        const moodData = {
            mood: mood,
            currentTrack: api.currentTrack?.title || null
        };

        // 保存到本地存储
        const moodHistory = window.cacheManager.getLocalCache('musicbox-mood-history') || [];
        moodHistory.push(moodData);

        // 只保留最近100条记录
        if (moodHistory.length > 100) {
            moodHistory.splice(0, moodHistory.length - 100);
        }

        window.cacheManager.setLocalCache('musicbox-mood-history', moodHistory);
    }

    saveMusicDiary() {
        const diaryInput = this.container.querySelector('.diary-input');
        if (!diaryInput || !diaryInput.value.trim()) return;

        const diaryEntry = {
            content: diaryInput.value.trim(),
            currentTrack: api.currentTrack?.title || null
        };

        // 保存到本地存储
        const diaryHistory = window.cacheManager.getLocalCache('musicbox-diary-history') || [];
        diaryHistory.push(diaryEntry);
        window.cacheManager.setLocalCache('musicbox-diary-history', diaryHistory);

        // 清空输入框并显示保存成功提示
        diaryInput.value = '';
        const saveBtn = this.container.querySelector('.save-diary-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已保存';
        saveBtn.disabled = true;

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }, 2000);
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="page-content clean-home">
                <!-- 欢迎区域 -->
                <div class="welcome-section">
                    <div class="welcome-content">
                        <h1 class="welcome-title">欢迎回到 MusicBox</h1>
                        <p class="welcome-subtitle">让音乐陪伴你的每一刻</p>
                    </div>
                    <div class="welcome-visual">
                        <div class="music-waves">
                            <div class="wave"></div>
                            <div class="wave"></div>
                            <div class="wave"></div>
                            <div class="wave"></div>
                        </div>
                    </div>
                </div>

                <!-- 音乐可视化中心 -->
                <div class="music-visualization-center">
                    <div class="visualization-container">
                        <canvas id="audio-visualizer" class="audio-visualizer"></canvas>
                        <div class="breathing-guide">
                            <div class="breathing-circle" id="breathing-circle">
                                <div class="breathing-text">深呼吸</div>
                            </div>
                        </div>
                        <div class="ambient-overlay" id="ambient-overlay"></div>
                    </div>

                    <div class="visualization-controls">
                        <button class="viz-control-btn" id="toggle-visualizer" title="音频可视化">
                            <svg viewBox="0 0 24 24">
                                <path d="M3,2H5V22H3V2M7,12H9V22H7V12M11,6H13V22H11V6M15,9H17V22H15V9M19,13H21V22H19V13Z"/>
                            </svg>
                        </button>
                        <button class="viz-control-btn" id="toggle-breathing" title="呼吸引导">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6Z"/>
                            </svg>
                        </button>
                        <button class="viz-control-btn" id="toggle-ambient" title="环境氛围">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,18.5A6.5,6.5 0 0,1 5.5,12A6.5,6.5 0 0,1 12,5.5A6.5,6.5 0 0,1 18.5,12A6.5,6.5 0 0,1 12,18.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- 核心功能区域 -->
                <div class="core-features-section">
                    <div class="features-grid">
                        <!-- 专注模式 -->
                        <div class="feature-card focus-mode-card" id="focus-mode-card">
                            <div class="feature-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                                </svg>
                            </div>
                            <div class="feature-content">
                                <h3>专注模式</h3>
                                <p>进入沉浸式音乐聆听体验，屏蔽干扰，专注当下</p>
                                <button class="focus-btn feature-btn">开始专注</button>
                            </div>
                        </div>

                        <!-- 聆听心情 -->
                        <div class="feature-card mood-card" id="mood-journal-card">
                            <div class="feature-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                                </svg>
                            </div>
                            <div class="feature-content">
                                <h3>聆听心情</h3>
                                <p>记录每次聆听时的心情状态，让音乐与情感产生共鸣</p>
                                <div class="mood-buttons">
                                    <button class="mood-btn" data-mood="happy" title="开心">😊</button>
                                    <button class="mood-btn" data-mood="calm" title="平静">😌</button>
                                    <button class="mood-btn" data-mood="sad" title="忧伤">😢</button>
                                    <button class="mood-btn" data-mood="excited" title="兴奋">🤩</button>
                                    <button class="mood-btn" data-mood="relaxed" title="放松">😎</button>
                                    <button class="mood-btn" data-mood="nostalgic" title="怀念">🥺</button>
                                </div>
                            </div>
                        </div>

                        <!-- 音乐日记 -->
                        <div class="feature-card diary-card" id="music-diary-card">
                            <div class="feature-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                            </div>
                            <div class="feature-content">
                                <h3>音乐日记</h3>
                                <p>记录音乐带给你的感悟和思考，珍藏美好的聆听时光</p>
                                <div class="diary-container">
                                    <textarea class="diary-input" placeholder="今天的音乐让我想到了..." rows="3"></textarea>
                                    <button class="save-diary-btn feature-btn">保存感悟</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 快速开始区域 -->
                <div class="quick-start-section">
                    <div class="quick-start-content">
                        <h2 class="quick-start-title">开启你的音乐之旅</h2>
                        <p class="quick-start-subtitle">让音乐成为生活的一部分</p>
                        <div class="quick-start-actions">
                            <button class="quick-start-btn primary" id="scan-folder-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                                </svg>
                                <span>扫描音乐文件夹</span>
                            </button>
                            <button class="quick-start-btn secondary" id="add-files-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                                </svg>
                                <span>添加音乐文件</span>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.setupPageEventListeners();
        this.initializeVisualizationState();
        this.initializeFocusModeState();
    }

    // 初始化专注模式状态
    initializeFocusModeState() {
        const isInFocusMode = document.body.classList.contains('focus-mode');
        this.updateFocusModeButton(isInFocusMode);
    }

    // 初始化可视化状态
    initializeVisualizationState() {
        const visualizer = this.container.querySelector('#audio-visualizer');
        const breathingGuide = this.container.querySelector('.breathing-guide');
        const ambientOverlay = this.container.querySelector('#ambient-overlay');

        if (visualizer) {
            visualizer.classList.add('active');
            this.startAudioVisualization();
        }

        if (breathingGuide) {
            breathingGuide.style.display = 'none';
        }

        if (ambientOverlay) {
            ambientOverlay.classList.remove('active');
        }
    }

    setupPageEventListeners() {
        // 沉浸式首页功能事件监听器
        this.setupImmersiveEventListeners();

        // 扫描文件夹按钮
        const scanBtn = this.container.querySelector('#scan-folder-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', async () => {
                try {
                    const directory = await api.openDirectory();
                    if (directory) {
                        const success = await api.scanDirectory(directory);
                        if (success) {
                            this.tracks = await api.getTracks();
                            this.render();
                        }
                    }
                } catch (error) {
                    console.error('扫描文件夹失败:', error);
                }
            });
        }

        // 添加文件按钮
        const addFilesBtn = this.container.querySelector('#add-files-btn');
        if (addFilesBtn) {
            addFilesBtn.addEventListener('click', async () => {
                try {
                    await app.addMusicFiles();
                    this.tracks = await api.getTracks();
                    this.render();
                } catch (error) {
                    console.error('添加文件失败:', error);
                }
            });
        }
    }
}

window.components.component.HomePage = HomePage;
