/**
 * 编辑歌曲信息对话框组件
 */

class EditTrackInfoDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentTrack = null;
        this.selectedCoverFile = null;
        this.originalData = null;
        this.coverObjectUrls = new Set(); // 用于跟踪创建的Object URLs
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    async show(track) {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        if (!track) {
            console.error('❌ EditTrackInfoDialog: 无效的歌曲数据');
            return;
        }

        this.currentTrack = track;
        this.selectedCoverFile = null;
        this.isVisible = true;

        // 清理之前的Object URLs
        this.cleanupCoverUrls();

        // 保存原始数据用于比较
        this.originalData = {
            title: track.title || '',
            artist: track.artist || '',
            album: track.album || '',
            year: track.year || '',
            genre: track.genre || ''
        };

        // 填充表单数据（先显示基本信息）
        this.populateForm();

        // 显示对话框
        this.dialog.style.display = 'flex';

        // 聚焦到第一个输入框
        setTimeout(() => {
            this.titleInput.focus();
            this.titleInput.select();
        }, 100);

        // 异步加载封面（如果需要）
        if (!track.cover && track.filePath) {
            this.loadCoverFromAPI(track).then(success => {
                if (success) {
                    console.log('✅ EditTrackInfoDialog: 封面加载完成');
                }
            }).catch(error => {
                console.error('❌ EditTrackInfoDialog: 异步加载封面失败', error);
            });
        }
    }

    hide() {
        this.isVisible = false;
        this.dialog.style.display = 'none';
        this.clearForm();
        this.clearErrors();
        this.cleanupCoverUrls(); // 清理Object URLs
    }

    destroy() {
        this.currentTrack = null;
        this.selectedCoverFile = null;
        this.originalData = null;
        this.coverObjectUrls = null;
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        this.dialog = document.getElementById('edit-track-info-dialog');
        this.closeBtn = document.getElementById('edit-track-info-close');
        this.cancelBtn = document.getElementById('edit-track-info-cancel');
        this.confirmBtn = document.getElementById('edit-track-info-confirm');

        // 表单元素
        this.coverPreview = document.getElementById('edit-track-cover');
        this.selectCoverBtn = document.getElementById('select-cover-btn');
        this.removeCoverBtn = document.getElementById('remove-cover-btn');
        this.titleInput = document.getElementById('edit-track-title');
        this.artistInput = document.getElementById('edit-track-artist');
        this.albumInput = document.getElementById('edit-track-album');
        this.yearInput = document.getElementById('edit-track-year');
        this.genreInput = document.getElementById('edit-track-genre');

        // 错误提示元素
        this.titleError = document.getElementById('edit-track-title-error');
        this.artistError = document.getElementById('edit-track-artist-error');
        this.albumError = document.getElementById('edit-track-album-error');
    }

    setupEventListeners() {
        // 关闭按钮
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());

        // 确认保存
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.saveChanges());

        // 封面操作
        this.addEventListenerManaged(this.selectCoverBtn, 'click', () => this.selectCover());
        this.addEventListenerManaged(this.removeCoverBtn, 'click', () => this.removeCover());

        // 输入验证
        this.addEventListenerManaged(this.titleInput, 'input', () => this.validateForm());
        this.addEventListenerManaged(this.artistInput, 'input', () => this.validateForm());
        this.addEventListenerManaged(this.albumInput, 'input', () => this.validateForm());

        // 点击遮罩关闭
        this.addEventListenerManaged(this.dialog, 'click', (e) => {
            if (e.target === this.dialog) {
                this.hide();
            }
        });

        // ESC键关闭
        this.addEventListenerManaged(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    // 清理创建的Object URLs
    cleanupCoverUrls() {
        if (this.coverObjectUrls && this.coverObjectUrls.size > 0) {
            console.log(`🧹 EditTrackInfoDialog: 清理 ${this.coverObjectUrls.size} 个Object URLs`);
            this.coverObjectUrls.forEach(url => {
                URL.revokeObjectURL(url);
            });
            this.coverObjectUrls.clear();
        }
    }

    // 使用API加载封面
    async loadCoverFromAPI(track) {
        try {
            if (!window.api || !window.api.getCover) {
                return false;
            }

            const result = await window.api.getCover(track.title, track.artist, track.album, track.filePath);

            if (result.success && typeof result.imageUrl === 'string') {
                track.cover = result.imageUrl;

                if (this.isVisible) {
                    this.refreshCoverPreview();
                }

                return true;
            }

            return false;
        } catch (error) {
            console.error('获取封面失败:', error);
            return false;
        }
    }

    populateForm() {
        // 填充基本信息
        this.titleInput.value = this.currentTrack.title || '';
        this.artistInput.value = this.currentTrack.artist || '';
        this.albumInput.value = this.currentTrack.album || '';
        this.yearInput.value = this.currentTrack.year || '';
        this.genreInput.value = this.currentTrack.genre || '';

        // 设置封面（支持异步加载的封面数据）
        this.updateCoverPreview();

        // 验证表单
        this.validateForm();
    }

    // 刷新封面预览（用于异步加载封面后的更新）
    refreshCoverPreview() {
        console.log('🔄 EditTrackInfoDialog: 刷新封面预览');
        this.updateCoverPreview();
    }

    updateCoverPreview() {
        try {
            console.log('🔄 EditTrackInfoDialog: 更新封面预览');

            if (this.selectedCoverFile) {
                // 如果选择了新封面，显示新封面
                console.log('🖼️ EditTrackInfoDialog: 使用新选择的封面文件');
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    console.log('✅ EditTrackInfoDialog: FileReader生成Data URL成功', dataUrl.substring(0, 50) + '...');
                    console.log('🔄 EditTrackInfoDialog: 即将设置coverPreview.src =', dataUrl.substring(0, 50) + '...');
                    this.coverPreview.src = dataUrl;
                    console.log('✅ EditTrackInfoDialog: 封面预览更新成功');
                };
                reader.onerror = (e) => {
                    console.error('❌ EditTrackInfoDialog: FileReader读取失败', e);
                    console.log('🔄 EditTrackInfoDialog: 即将设置coverPreview.src = default-cover.svg');
                    this.coverPreview.src = 'assets/images/default-cover.svg';
                    this.showError('封面预览加载失败');
                };
                reader.readAsDataURL(this.selectedCoverFile);
            } else if (this.currentTrack.cover) {
                // 显示当前封面 - 需要处理不同的封面数据格式
                console.log('🖼️ EditTrackInfoDialog: 使用当前歌曲封面', {
                    type: typeof this.currentTrack.cover,
                    constructor: this.currentTrack.cover.constructor.name,
                    value: typeof this.currentTrack.cover === 'string' ?
                        this.currentTrack.cover.substring(0, 100) + '...' :
                        JSON.stringify(this.currentTrack.cover)
                });
                this.processCoverData(this.currentTrack.cover);
            } else {
                // 显示默认封面
                console.log('🖼️ EditTrackInfoDialog: 使用默认封面');
                console.log('🔄 EditTrackInfoDialog: 即将设置coverPreview.src = default-cover.svg');
                this.coverPreview.src = 'assets/images/default-cover.svg';
            }
        } catch (error) {
            console.error('❌ EditTrackInfoDialog: 更新封面预览失败', error);
            console.log('🔄 EditTrackInfoDialog: 错误恢复，即将设置coverPreview.src = default-cover.svg');
            this.coverPreview.src = 'assets/images/default-cover.svg';
        }
    }

    // 处理不同格式的封面数据
    processCoverData(coverData) {
        try {
            console.log('🔍 EditTrackInfoDialog: 分析封面数据格式', {
                type: typeof coverData,
                isString: typeof coverData === 'string',
                isObject: typeof coverData === 'object',
                isNull: coverData === null,
                isUndefined: coverData === undefined,
                constructor: coverData ? coverData.constructor.name : 'N/A',
                value: typeof coverData === 'string' ?
                    coverData.substring(0, 100) + '...' :
                    (coverData ? JSON.stringify(coverData) : coverData)
            });

            // 首先检查是否为null或undefined
            if (coverData === null || coverData === undefined) {
                console.log('ℹ️ EditTrackInfoDialog: 封面数据为空，使用默认封面');
                this.setDefaultCover();
                return;
            }

            if (typeof coverData === 'string') {
                // 如果是字符串，可能是URL或base64数据
                if (coverData.trim() === '') {
                    console.log('ℹ️ EditTrackInfoDialog: 封面数据为空字符串，使用默认封面');
                    this.setDefaultCover();
                    return;
                }

                if (this.isValidUrl(coverData)) {
                    // 有效的URL格式
                    console.log('✅ EditTrackInfoDialog: 封面数据是有效URL');
                    this.setCoverWithValidation(coverData);
                } else {
                    // 可能是base64编码的数据（没有data:前缀）
                    console.log('🔄 EditTrackInfoDialog: 尝试作为base64数据处理');
                    const base64Url = `data:image/jpeg;base64,${coverData}`;
                    this.setCoverWithValidation(base64Url);
                }
            } else if (typeof coverData === 'object') {
                // 如果是对象，可能包含format和data字段
                console.log('🔄 EditTrackInfoDialog: 处理对象格式的封面数据', {
                    hasData: !!coverData.data,
                    hasFormat: !!coverData.format,
                    keys: Object.keys(coverData)
                });

                if (coverData.data) {
                    console.log('🔄 EditTrackInfoDialog: 对象包含data字段，尝试转换为URL');
                    this.convertCoverObjectToUrl(coverData);
                } else {
                    console.warn('⚠️ EditTrackInfoDialog: 封面对象缺少data字段', coverData);
                    this.setDefaultCover();
                }
            } else {
                console.error('❌ EditTrackInfoDialog: 未知的封面数据格式', {
                    type: typeof coverData,
                    constructor: coverData.constructor ? coverData.constructor.name : 'unknown',
                    value: coverData
                });
                this.setDefaultCover();
            }
        } catch (error) {
            console.error('❌ EditTrackInfoDialog: 处理封面数据失败', error);
            this.setDefaultCover();
        }
    }

    // 验证URL是否有效
    isValidUrl(url) {
        if (!url || typeof url !== 'string') {
            console.log('🔍 EditTrackInfoDialog: URL验证失败 - 无效参数', {
                url: url,
                type: typeof url
            });
            return false;
        }

        // 检查常见的URL格式
        const validPrefixes = ['data:', 'blob:', 'file:', 'http:', 'https:'];
        const isValid = validPrefixes.some(prefix => url.startsWith(prefix));

        console.log('🔍 EditTrackInfoDialog: URL验证结果', {
            url: url.substring(0, 50) + '...',
            isValid: isValid,
            matchedPrefix: validPrefixes.find(prefix => url.startsWith(prefix)) || 'none'
        });

        return isValid;
    }

    // 设置封面并添加验证
    setCoverWithValidation(url) {
        // 严格的类型检查
        if (typeof url !== 'string') {
            console.error('❌ EditTrackInfoDialog: setCoverWithValidation收到非字符串URL', {
                type: typeof url,
                constructor: url ? url.constructor.name : 'N/A',
                value: url
            });
            this.setDefaultCover();
            return;
        }

        if (!url || url.trim() === '') {
            console.error('❌ EditTrackInfoDialog: setCoverWithValidation收到空URL');
            this.setDefaultCover();
            return;
        }

        console.log('🔄 EditTrackInfoDialog: 设置封面URL', {
            url: url.substring(0, 100) + '...',
            urlType: url.split(':')[0],
            urlLength: url.length
        });

        // 清除之前的事件处理器
        this.coverPreview.onload = null;
        this.coverPreview.onerror = null;

        // 设置新的事件处理器
        this.coverPreview.onload = () => {
            console.log('✅ EditTrackInfoDialog: 封面加载成功', {
                naturalWidth: this.coverPreview.naturalWidth,
                naturalHeight: this.coverPreview.naturalHeight,
                src: this.coverPreview.src.substring(0, 100) + '...'
            });
        };
        this.coverPreview.onerror = (event) => {
            console.warn('⚠️ EditTrackInfoDialog: 封面加载失败，使用默认封面', {
                url: url.substring(0, 100) + '...',
                error: event,
                actualSrc: this.coverPreview.src
            });
            this.setDefaultCover();
        };

        // 设置图片源前再次验证
        console.log('🔄 EditTrackInfoDialog: 即将设置coverPreview.src =', url.substring(0, 100) + '...');
        this.coverPreview.src = url;
        console.log('✅ EditTrackInfoDialog: coverPreview.src已设置');
    }

    // 设置默认封面
    setDefaultCover() {
        this.coverPreview.src = 'assets/images/default-cover.svg';
        this.coverPreview.onload = null;
        this.coverPreview.onerror = null;
    }

    // 检查是否为类似Buffer的对象
    isBufferLike(obj) {
        if (!obj) return false;

        // 检查是否有Buffer的特征
        if (typeof obj === 'object' &&
            typeof obj.length === 'number' &&
            typeof obj.constructor === 'function') {

            // 检查构造函数名称
            const constructorName = obj.constructor.name;
            if (constructorName === 'Buffer') {
                return true;
            }

            // 检查是否有Buffer的方法
            if (typeof obj.slice === 'function' &&
                typeof obj.toString === 'function' &&
                obj.length >= 0) {
                return true;
            }
        }

        return false;
    }

    // 将封面对象转换为可用的URL
    convertCoverObjectToUrl(coverObject) {
        try {
            console.log('🔄 EditTrackInfoDialog: 转换封面对象为URL', {
                format: coverObject.format,
                dataType: typeof coverObject.data,
                dataLength: coverObject.data ? coverObject.data.length : 0,
                dataConstructor: coverObject.data ? coverObject.data.constructor.name : 'N/A'
            });

            let imageData = coverObject.data;
            const format = coverObject.format || 'jpeg';

            // 验证数据是否存在
            if (!imageData) {
                console.warn('⚠️ EditTrackInfoDialog: 封面数据为空');
                this.setDefaultCover();
                return;
            }

            // 详细的数据类型分析
            console.log('🔍 EditTrackInfoDialog: 详细数据分析', {
                isArrayBuffer: imageData instanceof ArrayBuffer,
                isArray: Array.isArray(imageData),
                isUint8Array: imageData instanceof Uint8Array,
                isBufferLike: this.isBufferLike(imageData),
                hasLength: typeof imageData.length === 'number',
                length: imageData.length
            });

            // 处理不同类型的数据
            if (imageData instanceof ArrayBuffer) {
                imageData = new Uint8Array(imageData);
                console.log('🔄 EditTrackInfoDialog: 转换ArrayBuffer为Uint8Array');
            } else if (Array.isArray(imageData)) {
                imageData = new Uint8Array(imageData);
                console.log('🔄 EditTrackInfoDialog: 转换Array为Uint8Array');
            } else if (imageData instanceof Uint8Array) {
                // 已经是正确格式
                console.log('✅ EditTrackInfoDialog: 数据已是Uint8Array格式');
            } else if (this.isBufferLike(imageData)) {
                // 处理类似Buffer的对象（如Node.js Buffer在某些环境下的表现）
                imageData = new Uint8Array(imageData);
                console.log('🔄 EditTrackInfoDialog: 转换Buffer-like对象为Uint8Array');
            } else {
                // 最后的降级方案：尝试直接使用数据
                console.warn('⚠️ EditTrackInfoDialog: 未知数据类型，尝试降级处理', {
                    type: typeof imageData,
                    constructor: imageData.constructor ? imageData.constructor.name : 'unknown',
                    hasLength: 'length' in imageData,
                    length: imageData.length
                });

                try {
                    // 尝试将数据转换为Uint8Array
                    if (imageData.length && typeof imageData.length === 'number') {
                        imageData = new Uint8Array(imageData);
                        console.log('✅ EditTrackInfoDialog: 降级转换成功');
                    } else {
                        throw new Error('无法转换数据类型');
                    }
                } catch (conversionError) {
                    console.error('❌ EditTrackInfoDialog: 降级转换失败', conversionError);
                    this.setDefaultCover();
                    return;
                }
            }

            // 验证数据长度
            if (!imageData.length || imageData.length === 0) {
                console.warn('⚠️ EditTrackInfoDialog: 封面数据长度为0');
                this.setDefaultCover();
                return;
            }

            console.log(`✅ EditTrackInfoDialog: 数据转换完成，长度: ${imageData.length}`);

            // 创建Blob
            const mimeType = format.toLowerCase();
            const blob = new Blob([imageData], {type: mimeType});

            // 验证Blob
            if (blob.size === 0) {
                console.warn('⚠️ EditTrackInfoDialog: 创建的Blob大小为0');
                this.setDefaultCover();
                return;
            }
            console.log(`✅ EditTrackInfoDialog: Blob创建成功，大小: ${blob.size}, 类型: ${mimeType}`);

            // 创建Object URL
            const objectUrl = URL.createObjectURL(blob);
            console.log('✅ EditTrackInfoDialog: 封面Object URL创建成功', objectUrl);

            // 设置图片源并添加验证
            this.coverPreview.src = objectUrl;
            this.coverPreview.onload = () => {
                console.log('✅ EditTrackInfoDialog: Object URL封面加载成功');
            };
            this.coverPreview.onerror = () => {
                console.warn('⚠️ EditTrackInfoDialog: Object URL封面加载失败，使用默认封面');
                URL.revokeObjectURL(objectUrl); // 清理URL
                this.coverObjectUrls.delete(objectUrl); // 从集合中移除
                this.setDefaultCover();
            };

            // 记录URL用于后续清理
            this.coverObjectUrls.add(objectUrl);
        } catch (error) {
            console.error('❌ EditTrackInfoDialog: 转换封面对象失败', error);
            console.error('❌ 错误详情:', {
                message: error.message,
                stack: error.stack,
                coverObject: coverObject
            });
            this.setDefaultCover();
        }
    }

    async selectCover() {
        try {
            // 检查API可用性
            const apiStatus = this.checkAPIAvailability();

            if (!apiStatus.electronAPI) {
                console.error('❌ EditTrackInfoDialog: electronAPI 不可用');
                this.showError('系统接口不可用，请重启应用后重试');
                return;
            }
            console.log('🎵 EditTrackInfoDialog: 开始选择封面');

            let result;
            // 优先使用通用的dialog API
            if (apiStatus.showOpenDialog) {
                console.log('🎵 EditTrackInfoDialog: 使用通用dialog API');
                result = await window.electronAPI.dialog.showOpenDialog({
                    title: '选择专辑封面',
                    filters: [
                        {name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']}
                    ],
                    properties: ['openFile']
                });
            } else if (window.electronAPI.openImageFile) {
                // 备用方案：使用现有的openImageFile API
                console.log('🎵 EditTrackInfoDialog: 使用备用openImageFile API');
                result = await window.electronAPI.openImageFile();
            } else {
                throw new Error('没有可用的文件选择API');
            }
            console.log('🎵 EditTrackInfoDialog: 文件选择结果', result);

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                console.log('🎵 EditTrackInfoDialog: 选择的文件路径', filePath);

                // 验证文件大小（限制为5MB）
                if (apiStatus.stat) {
                    try {
                        const stats = await window.electronAPI.fs.stat(filePath);
                        console.log('🎵 EditTrackInfoDialog: 文件统计信息', stats);

                        if (stats.size > 5 * 1024 * 1024) {
                            this.showError('封面文件大小不能超过5MB');
                            return;
                        }
                    } catch (statError) {
                        console.error('❌ EditTrackInfoDialog: 获取文件信息失败', statError);
                        console.warn('⚠️ EditTrackInfoDialog: 跳过文件大小验证');
                    }
                } else {
                    console.warn('⚠️ EditTrackInfoDialog: fs.stat API不可用，跳过文件大小验证');
                }

                // 读取文件
                if (apiStatus.readFile) {
                    try {
                        console.log('🎵 EditTrackInfoDialog: 开始读取文件数据');
                        const fileData = await window.electronAPI.fs.readFile(filePath);
                        console.log('🎵 EditTrackInfoDialog: 文件数据读取完成，大小:', fileData.length);

                        // 创建File对象
                        const uint8Array = new Uint8Array(fileData);
                        this.selectedCoverFile = new File([uint8Array], 'cover.jpg', {type: 'image/jpeg'});

                        this.updateCoverPreview();
                        this.validateForm();

                        console.log('✅ EditTrackInfoDialog: 封面选择成功', filePath);
                    } catch (readError) {
                        console.error('❌ EditTrackInfoDialog: 读取文件失败', readError);
                        this.showError('读取文件失败，请选择其他文件');
                        return;
                    }
                } else {
                    // 备用方案：使用HTML5 File API（如果用户通过拖拽等方式选择文件）
                    console.warn('⚠️ EditTrackInfoDialog: fs.readFile API不可用，尝试备用方案');
                    this.showError('文件读取API不可用，请重启应用后重试');
                    return;
                }
            } else {
                console.log('🎵 EditTrackInfoDialog: 用户取消了文件选择');
            }
        } catch (error) {
            console.error('❌ EditTrackInfoDialog: 选择封面失败', error);

            // 根据错误类型提供更具体的错误信息
            let errorMessage = '选择封面失败：';
            if (error.message.includes('Cannot read properties of undefined')) {
                errorMessage += 'API接口不可用，请重启应用后重试';
            } else if (error.message.includes('dialog')) {
                errorMessage += '文件选择对话框打开失败';
            } else if (error.message.includes('fs')) {
                errorMessage += '文件系统访问失败';
            } else {
                errorMessage += error.message || '未知错误';
            }

            this.showError(errorMessage);
        }
    }

    removeCover() {
        this.selectedCoverFile = null;
        this.coverPreview.src = 'assets/images/default-cover.svg';
        this.validateForm();
        console.log('🎵 EditTrackInfoDialog: 移除封面');
    }

    validateForm() {
        this.clearErrors();
        let isValid = true;

        // 验证歌曲名称
        const title = this.titleInput.value.trim();
        if (!title) {
            this.showFieldError('title', '歌曲名称不能为空');
            isValid = false;
        } else if (title.length > 100) {
            this.showFieldError('title', '歌曲名称不能超过100个字符');
            isValid = false;
        }

        // 验证艺术家
        const artist = this.artistInput.value.trim();
        if (!artist) {
            this.showFieldError('artist', '艺术家不能为空');
            isValid = false;
        } else if (artist.length > 100) {
            this.showFieldError('artist', '艺术家名称不能超过100个字符');
            isValid = false;
        }

        // 验证专辑（可选）
        const album = this.albumInput.value.trim();
        if (album.length > 100) {
            this.showFieldError('album', '专辑名称不能超过100个字符');
            isValid = false;
        }

        // 验证年份（可选）
        const year = this.yearInput.value.trim();
        if (year && (isNaN(year) || year < 1900 || year > 2099)) {
            this.showFieldError('year', '请输入有效的年份（1900-2099）');
            isValid = false;
        }

        // 检查是否有更改
        const hasChanges = this.hasChanges();

        // 更新确认按钮状态
        this.confirmBtn.disabled = !isValid || !hasChanges;

        return isValid;
    }

    hasChanges() {
        const currentData = {
            title: this.titleInput.value.trim(),
            artist: this.artistInput.value.trim(),
            album: this.albumInput.value.trim(),
            year: this.yearInput.value.trim(),
            genre: this.genreInput.value.trim()
        };

        // 检查基本信息是否有变化
        for (const key in currentData) {
            if (currentData[key] !== (this.originalData[key] || '')) {
                return true;
            }
        }

        // 检查是否选择了新封面
        return this.selectedCoverFile !== null;
    }

    showFieldError(field, message) {
        const errorElement = this[field + 'Error'];
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearErrors() {
        this.titleError.style.display = 'none';
        this.artistError.style.display = 'none';
        this.albumError.style.display = 'none';
    }

    showError(message) {
        console.error('❌ EditTrackInfoDialog:', message);

        // 显示错误提示（使用简单的alert，后续可以改为更优雅的提示）
        // 也可以通过全局事件系统显示错误
        if (window.app && window.app.showError) {
            window.app.showError(message);
        } else {
            // 备用方案：使用浏览器原生alert
            alert('错误：' + message);
        }
    }

    clearForm() {
        this.titleInput.value = '';
        this.artistInput.value = '';
        this.albumInput.value = '';
        this.yearInput.value = '';
        this.genreInput.value = '';
        this.coverPreview.src = 'assets/images/default-cover.svg';
        this.selectedCoverFile = null;
        this.confirmBtn.disabled = true;
    }

    async saveChanges() {
        if (!this.validateForm()) {
            return;
        }

        try {
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '保存中...';

            const updatedData = {
                filePath: this.currentTrack.filePath,
                title: this.titleInput.value.trim(),
                artist: this.artistInput.value.trim(),
                album: this.albumInput.value.trim(),
                year: this.yearInput.value.trim() || null,
                genre: this.genreInput.value.trim() || null
            };

            // 如果选择了新封面，添加封面数据
            if (this.selectedCoverFile) {
                try {
                    const arrayBuffer = await this.selectedCoverFile.arrayBuffer();
                    updatedData.cover = Array.from(new Uint8Array(arrayBuffer));
                    console.log('🖼️ EditTrackInfoDialog: 封面数据准备完成');
                } catch (coverError) {
                    console.error('❌ EditTrackInfoDialog: 封面数据处理失败', coverError);
                    throw new Error('封面图片处理失败，请重新选择封面');
                }
            }

            console.log('📝 EditTrackInfoDialog: 开始保存歌曲信息', updatedData.title);

            // 调用主进程保存更改
            const result = await window.electronAPI.library.updateTrackMetadata(updatedData);

            if (result.success) {
                console.log('✅ EditTrackInfoDialog: 歌曲信息保存成功');

                // 如果保存了新封面，更新封面URL
                if (this.selectedCoverFile && result.updatedMetadata && result.updatedMetadata.cover) {
                    try {
                        const coverResult = await window.api.getCover(
                            result.updatedMetadata.title,
                            result.updatedMetadata.artist,
                            result.updatedMetadata.album,
                            result.updatedMetadata.filePath
                        );

                        if (coverResult.success && typeof coverResult.imageUrl === 'string') {
                            this.currentTrack.cover = coverResult.imageUrl;
                        } else {
                            this.currentTrack.cover = null;
                        }
                    } catch (apiError) {
                        console.error('获取封面URL失败:', apiError);
                        this.currentTrack.cover = null;
                    }

                    this.selectedCoverFile = null;
                    this.updateCoverPreview();
                }

                // 准备更新数据
                const safeUpdatedData = {
                    ...(result.updatedMetadata || updatedData),
                    cover: this.currentTrack.cover
                };

                // 如果封面被更新，手动触发封面刷新
                if (result.coverUpdated && window.coverUpdateManager) {
                    console.log('🖼️ EditTrackInfoDialog: 检测到封面更新，触发刷新');
                    try {
                        await window.coverUpdateManager.refreshCover(
                            this.currentTrack.filePath,
                            safeUpdatedData.title || this.currentTrack.title,
                            safeUpdatedData.artist || this.currentTrack.artist,
                            safeUpdatedData.album || this.currentTrack.album
                        );
                    } catch (error) {
                        console.warn('⚠️ EditTrackInfoDialog: 封面刷新失败:', error);
                    }
                }

                // 发出更新事件
                this.emit('trackUpdated', {
                    track: this.currentTrack,
                    updatedData: safeUpdatedData
                });

                this.hide();
            } else {
                throw new Error(result.error || '保存失败，请检查文件权限或文件格式是否支持');
            }
        } catch (error) {
            console.error('❌ EditTrackInfoDialog: 保存失败', error);

            // 根据错误类型提供更具体的错误信息
            let errorMessage = '保存失败：';
            if (error.message.includes('权限')) {
                errorMessage += '文件没有写入权限，请检查文件是否被其他程序占用';
            } else if (error.message.includes('格式')) {
                errorMessage += '文件格式不支持元数据编辑';
            } else if (error.message.includes('网络')) {
                errorMessage += '网络文件访问失败，请检查网络连接';
            } else {
                errorMessage += error.message;
            }

            this.showError(errorMessage);
        } finally {
            this.confirmBtn.disabled = false;
            this.confirmBtn.textContent = '保存更改';
        }
    }
}

window.components.dialogs.EditTrackInfoDialog = EditTrackInfoDialog;
