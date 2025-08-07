/**
 * 首页组件
 */

class HomePage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.personalizedRecommendations = [];
        this.setupElements();
        console.log('🏠 HomePage: 新首页组件初始化完成');
    }

    setupElements() {
        this.container = this.element;
    }

    async show() {
        console.log('🏠 HomePage: 显示新首页');
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await api.getTracks();
        this.render();
    }

    hide() {
        console.log('🏠 HomePage: 隐藏首页');
        if (this.container) {
            this.container.innerHTML = '';
        }
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
                this.enterFocusMode();
            });
        }

        // 冥想计时器按钮
        this.container.querySelectorAll('.timer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                this.startMeditationTimer(minutes);
            });
        });

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

        // 时间氛围卡片
        const timeAtmosphereCard = this.container.querySelector('#time-atmosphere');
        if (timeAtmosphereCard) {
            timeAtmosphereCard.addEventListener('click', () => {
                this.toggleTimeBasedAtmosphere();
            });
        }

        // 天气同步卡片
        const weatherAtmosphereCard = this.container.querySelector('#weather-atmosphere');
        if (weatherAtmosphereCard) {
            weatherAtmosphereCard.addEventListener('click', () => {
                this.toggleWeatherSync();
            });
        }
    }

    // 沉浸式功能实现方法
    toggleAudioVisualizer() {
        const visualizer = this.container.querySelector('#audio-visualizer');
        if (!visualizer) return;

        const isActive = visualizer.classList.contains('active');
        if (isActive) {
            visualizer.classList.remove('active');
            this.stopAudioVisualization();
        } else {
            visualizer.classList.add('active');
            this.startAudioVisualization();
        }
        console.log('🎵 音频可视化:', isActive ? '关闭' : '开启');
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
        const breathingCircle = this.container.querySelector('#breathing-circle');
        if (!breathingCircle) return;

        const isActive = breathingCircle.classList.contains('active');
        if (isActive) {
            breathingCircle.classList.remove('active');
            this.stopBreathingGuide();
        } else {
            breathingCircle.classList.add('active');
            this.startBreathingGuide();
        }
        console.log('🫁 呼吸引导:', isActive ? '关闭' : '开启');
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
        console.log('🌅 环境氛围:', isActive ? '关闭' : '开启');
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

    enterFocusMode() {
        // 进入专注模式 - 隐藏干扰元素，突出音乐体验
        document.body.classList.add('focus-mode');

        // 启动所有沉浸式功能
        this.toggleAudioVisualizer();
        this.toggleBreathingGuide();
        this.toggleAmbientMode();

        console.log('🎯 进入专注模式');

        // 显示专注模式提示
        this.showFocusModeNotification();
    }

    showFocusModeNotification() {
        const notification = document.createElement('div');
        notification.className = 'focus-mode-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>专注模式已开启</h3>
                <p>享受沉浸式音乐体验</p>
                <button class="exit-focus-btn">退出专注模式</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 退出专注模式按钮
        notification.querySelector('.exit-focus-btn').addEventListener('click', () => {
            this.exitFocusMode();
            notification.remove();
        });

        // 5秒后自动隐藏通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    exitFocusMode() {
        document.body.classList.remove('focus-mode');
        console.log('🎯 退出专注模式');
    }

    startMeditationTimer(minutes) {
        console.log(`🧘 开始冥想计时: ${minutes}分钟`);

        // 创建冥想计时器界面
        const timerOverlay = document.createElement('div');
        timerOverlay.className = 'meditation-timer-overlay';
        timerOverlay.innerHTML = `
            <div class="timer-content">
                <div class="timer-circle">
                    <div class="timer-text">
                        <div class="timer-minutes">${minutes}</div>
                        <div class="timer-label">分钟</div>
                    </div>
                </div>
                <div class="timer-controls">
                    <button class="timer-pause-btn">暂停</button>
                    <button class="timer-stop-btn">停止</button>
                </div>
            </div>
        `;

        document.body.appendChild(timerOverlay);

        // 启动计时器逻辑
        this.runMeditationTimer(minutes, timerOverlay);
    }

    runMeditationTimer(totalMinutes, overlay) {
        let remainingSeconds = totalMinutes * 60;
        const timerText = overlay.querySelector('.timer-minutes');
        const pauseBtn = overlay.querySelector('.timer-pause-btn');
        const stopBtn = overlay.querySelector('.timer-stop-btn');

        let isPaused = false;
        let timerInterval;

        const updateTimer = () => {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (remainingSeconds <= 0) {
                this.completeMeditationTimer(overlay);
                return;
            }

            remainingSeconds--;
        };

        const startTimer = () => {
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();
        };

        pauseBtn.addEventListener('click', () => {
            if (isPaused) {
                startTimer();
                pauseBtn.textContent = '暂停';
                isPaused = false;
            } else {
                clearInterval(timerInterval);
                pauseBtn.textContent = '继续';
                isPaused = true;
            }
        });

        stopBtn.addEventListener('click', () => {
            clearInterval(timerInterval);
            overlay.remove();
        });

        startTimer();
    }

    completeMeditationTimer(overlay) {
        overlay.innerHTML = `
            <div class="timer-content">
                <div class="timer-complete">
                    <div class="complete-icon">✨</div>
                    <h3>冥想完成</h3>
                    <p>感谢您的专注时光</p>
                    <button class="close-timer-btn">关闭</button>
                </div>
            </div>
        `;

        overlay.querySelector('.close-timer-btn').addEventListener('click', () => {
            overlay.remove();
        });

        // 3秒后自动关闭
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 3000);
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
        console.log('💭 记录心情:', mood);
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

        console.log('📝 保存音乐日记');
    }

    toggleTimeBasedAtmosphere() {
        const card = this.container.querySelector('#time-atmosphere');
        const isActive = card.classList.contains('active');

        if (isActive) {
            card.classList.remove('active');
        } else {
            card.classList.add('active');
            this.updateTimeBasedAtmosphere();
        }

        console.log('⏰ 时间氛围:', isActive ? '关闭' : '开启');
    }

    updateTimeBasedAtmosphere() {
        const hour = new Date().getHours();
        const timeMoodText = this.container.querySelector('#time-mood-text');
        if (!timeMoodText) return;

        let moodText;
        if (hour >= 6 && hour < 12) {
            moodText = '清晨时光，适合轻松愉悦的音乐';
        } else if (hour >= 12 && hour < 18) {
            moodText = '午后阳光，享受温暖的旋律';
        } else if (hour >= 18 && hour < 22) {
            moodText = '黄昏时分，沉浸在柔和的音符中';
        } else {
            moodText = '夜深人静，让心灵在音乐中放松';
        }

        timeMoodText.textContent = moodText;
    }

    toggleWeatherSync() {
        const card = this.container.querySelector('#weather-atmosphere');
        const isActive = card.classList.contains('active');

        if (isActive) {
            card.classList.remove('active');
        } else {
            card.classList.add('active');
            // 这里可以添加实际的天气API调用
            console.log('🌤️ 天气同步功能需要天气API支持');
        }

        console.log('🌤️ 天气同步:', isActive ? '关闭' : '开启');
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="page-content immersive-home">
                <!-- 沉浸式音乐可视化中心 -->
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
                        <button class="viz-control-btn" id="toggle-visualizer" title="切换可视化">
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

                <!-- 情绪氛围调节器 -->
                <div class="mood-atmosphere-section">
                    <div class="atmosphere-cards">
                        <div class="atmosphere-card time-based" id="time-atmosphere">
                            <div class="atmosphere-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                                </svg>
                            </div>
                            <div class="atmosphere-content">
                                <h3>时光氛围</h3>
                                <p id="time-mood-text">根据当前时间调节界面氛围</p>
                            </div>
                        </div>

                        <div class="atmosphere-card weather-sync" id="weather-atmosphere">
                            <div class="atmosphere-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z"/>
                                </svg>
                            </div>
                            <div class="atmosphere-content">
                                <h3>天气同步</h3>
                                <p>与当地天气同步的背景效果</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 专注与冥想助手 -->
                <div class="focus-meditation-section">
                    <div class="focus-cards">
                        <div class="focus-card focus-mode" id="focus-mode-card">
                            <div class="focus-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                                </svg>
                            </div>
                            <div class="focus-content">
                                <h3>专注模式</h3>
                                <p>进入沉浸式音乐聆听体验</p>
                                <button class="focus-btn">开始专注</button>
                            </div>
                        </div>

                        <div class="focus-card meditation-timer" id="meditation-timer-card">
                            <div class="focus-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.78 12.45,22 13,22C13.55,22 14.05,21.78 14.41,21.41L21.41,14.41C21.78,14.05 22,13.55 22,13C22,12.45 21.78,11.95 21.41,11.58Z"/>
                                </svg>
                            </div>
                            <div class="focus-content">
                                <h3>冥想计时</h3>
                                <p>配合音乐的冥想和放松</p>
                                <div class="timer-controls">
                                    <button class="timer-btn" data-minutes="5">5分钟</button>
                                    <button class="timer-btn" data-minutes="10">10分钟</button>
                                    <button class="timer-btn" data-minutes="15">15分钟</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 音乐生活方式面板 -->
                <div class="music-lifestyle-section">
                    <div class="lifestyle-cards">
                        <div class="lifestyle-card mood-journal" id="mood-journal-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>聆听心情</h3>
                                <p>记录每次聆听时的心情状态</p>
                                <div class="mood-buttons">
                                    <button class="mood-btn" data-mood="happy">😊</button>
                                    <button class="mood-btn" data-mood="calm">😌</button>
                                    <button class="mood-btn" data-mood="sad">😢</button>
                                    <button class="mood-btn" data-mood="excited">🤩</button>
                                </div>
                            </div>
                        </div>

                        <div class="lifestyle-card music-diary" id="music-diary-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>音乐日记</h3>
                                <p>记录音乐带给你的感悟</p>
                                <textarea class="diary-input" placeholder="今天的音乐让我想到了..."></textarea>
                                <button class="save-diary-btn">保存感悟</button>
                            </div>
                        </div>

                        <div class="lifestyle-card listening-habits" id="listening-habits-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>聆听洞察</h3>
                                <p>美观展示你的聆听习惯</p>
                                <div class="habits-preview">
                                    <div class="habit-item">
                                        <span class="habit-label">今日聆听</span>
                                        <span class="habit-value" id="today-listening">0分钟</span>
                                    </div>
                                    <div class="habit-item">
                                        <span class="habit-label">最爱时段</span>
                                        <span class="habit-value" id="favorite-time">晚上</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 空状态 - 沉浸式引导 -->
                <div class="immersive-empty-state">
                    <div class="empty-visualization">
                        <div class="empty-waves">
                            <div class="wave"></div>
                            <div class="wave"></div>
                            <div class="wave"></div>
                        </div>
                    </div>
                    <div class="empty-content">
                        <h2>开启你的音乐之旅</h2>
                        <p>让音乐成为生活的一部分，创造属于你的沉浸式聆听体验</p>
                        <div class="empty-actions">
                            <button class="immersive-btn primary" id="scan-folder-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                                </svg>
                                扫描音乐文件夹
                            </button>
                            <button class="immersive-btn secondary" id="add-files-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                                </svg>
                                添加音乐文件
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.setupPageEventListeners();
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
                    await app.openFileDialog();
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
