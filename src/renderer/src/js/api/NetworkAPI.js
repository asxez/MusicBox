class NetworkAPI {
    constructor() {
        this.defaultMaxRetries = 3;
        this.timeout = 10000;
    }

    /**
     * 带重试机制的fetch请求
     * @param {string} url - 请求URL
     * @param {Object} options - fetch选项
     * @param {number} maxRetries - 最大重试次数
     * @returns {Promise<Response>} - fetch响应
     */
    async fetchWithRetry(url, options = {}, maxRetries = this.defaultMaxRetries) {
        const defaultOptions = {
            timeout: this.timeout,
            headers: {
                'User-Agent': 'MusicBox'
            },
            ...options
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🌐 网络请求 (尝试 ${attempt}/${maxRetries}): ${url}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);

                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                console.warn(`❌ 网络请求失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`);

                if (attempt === maxRetries) {
                    console.error(`🚫 网络请求最终失败: ${url}`);
                    throw error;
                }

                // 指数退避重试
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.log(`⏳ ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

let networkAPI = new NetworkAPI();
export {networkAPI};
