/**
 * URL有效性检查工具
 */

class URLValidator {
    constructor() {
        this.validationCache = new Map();
        this.cacheTimeout = 30000;
    }

    async isValidUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        // 检查基本格式
        if (!this.isValidUrlFormat(url)) {
            return false;
        }

        // blob URL
        if (url.startsWith('blob:')) {
            return await this.validateBlobUrl(url);
        }

        // http/https URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return await this.validateHttpUrl(url);
        }

        // data URL
        if (url.startsWith('data:')) {
            return this.validateDataUrl(url);
        }
        // 其他类型的URL暂时认为有效
        return true;
    }

    // 检查URL基本格式
    isValidUrlFormat(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    // 验证blob URL
    async validateBlobUrl(blobUrl) {
        // 检查缓存
        const cacheKey = blobUrl;
        const cached = this.validationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.valid;
        }

        try {
            // 首先检查blob URL格式
            if (!blobUrl.startsWith('blob:') || blobUrl.length < 10) {
                console.warn('⚠️ URLValidator: blob URL格式无效', blobUrl);
                return false;
            }

            // 尝试创建一个Image对象来测试URL
            const isValid = await this.testImageLoad(blobUrl);

            // 缓存结果，但对于失败的blob URL缓存时间更短
            const cacheTimeout = isValid ? this.cacheTimeout : 5000; // 失败结果只缓存5秒
            this.validationCache.set(cacheKey, {
                valid: isValid,
                timestamp: Date.now(),
                timeout: cacheTimeout
            });

            return isValid;
        } catch (error) {
            console.warn('⚠️ URLValidator: blob URL验证失败:', error);

            // 缓存失败结果，但时间较短
            this.validationCache.set(cacheKey, {
                valid: false,
                timestamp: Date.now(),
                timeout: 5000
            });
            return false;
        }
    }

    // 验证HTTP URL
    async validateHttpUrl(httpUrl) {
        // 检查缓存
        const cacheKey = httpUrl;
        const cached = this.validationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.valid;
        }

        try {
            // 使用HEAD请求检查资源是否存在
            const response = await fetch(httpUrl, {
                method: 'HEAD',
                timeout: 5000
            });

            const isValid = response.ok;

            // 缓存结果
            this.validationCache.set(cacheKey, {
                valid: isValid,
                timestamp: Date.now()
            });

            return isValid;
        } catch (error) {
            console.warn('⚠️ URLValidator: HTTP URL验证失败:', error);

            // 缓存失败结果
            this.validationCache.set(cacheKey, {
                valid: false,
                timestamp: Date.now()
            });

            return false;
        }
    }

    // 验证data URL
    validateDataUrl(dataUrl) {
        try {
            const dataUrlPattern = /^data:([a-zA-Z0-9][a-zA-Z0-9\/+\-]*);base64,(.+)$/;
            return dataUrlPattern.test(dataUrl);
        } catch (error) {
            return false;
        }
    }

    // 测试图片加载
    testImageLoad(url) {
        return new Promise((resolve) => {
            const img = new Image();
            let resolved = false;

            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                img.onload = null;
                img.onerror = null;
                img.onabort = null;
                // 不设置src为null，避免触发额外的错误
            };

            img.onload = () => {
                cleanup();
                resolve(true);
            };

            img.onerror = (event) => {
                console.warn('⚠️ URLValidator: 图片加载失败', {
                    url: url.substring(0, 50) + '...',
                    error: event.error || 'Unknown error'
                });
                cleanup();
                resolve(false);
            };

            img.onabort = () => {
                cleanup();
                resolve(false);
            };

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    console.warn('⚠️ URLValidator: 图片加载超时', url.substring(0, 50) + '...');
                    cleanup();
                    resolve(false);
                }
            }, 5000);

            try {
                img.src = url;
            } catch (error) {
                console.warn('⚠️ URLValidator: 设置图片src失败', error);
                clearTimeout(timeoutId);
                cleanup();
                resolve(false);
            }
        });
    }

    // 安全设置图片源
    async safeSetImageSrc(imgElement, url, fallbackUrl = null) {
        if (!imgElement || !url) {
            return false;
        }

        try {
            const isValid = await this.isValidUrl(url);

            if (isValid) {
                imgElement.src = url;
                // console.log(`✅ URLValidator: 安全设置图片源 - ${url.substring(0, 50)}...`);
                return true;
            } else {
                console.warn(`⚠️ URLValidator: URL无效，使用备用方案 - ${url.substring(0, 50)}...`);

                if (fallbackUrl) {
                    const fallbackValid = await this.isValidUrl(fallbackUrl);
                    if (fallbackValid) {
                        imgElement.src = fallbackUrl;
                        return true;
                    }
                }
                imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+';
                return false;
            }
        } catch (error) {
            console.error('❌ URLValidator: 安全设置图片源失败:', error);
            return false;
        }
    }

    // 清理验证缓存
    clearCache() {
        this.validationCache.clear();
    }

    // 清理过期的缓存项
    cleanupExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.validationCache.entries()) {
            const timeout = value.timeout || this.cacheTimeout;
            if (now - value.timestamp > timeout) {
                this.validationCache.delete(key);
            }
        }
    }
}

window.urlValidator = new URLValidator();
setInterval(() => {
    if (window.urlValidator) {
        window.urlValidator.cleanupExpiredCache();
    }
}, 15000);
