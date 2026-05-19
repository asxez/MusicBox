export interface NetworkRequestOptions extends RequestInit {
    timeout?: number;
    maxRetries?: number;
}

export class NetworkRequestError extends Error {
    readonly url: string;
    readonly statusCode?: number;
    readonly retryCount?: number;

    constructor(message: string, url: string, statusCode?: number, retryCount?: number) {
        super(message);
        this.name = 'NetworkRequestError';
        this.url = url;
        this.statusCode = statusCode;
        this.retryCount = retryCount;

        Object.setPrototypeOf(this, NetworkRequestError.prototype);
    }
}

export class NetworkTimeoutError extends Error {
    readonly operation: string;
    readonly timeout: number;

    constructor(operation: string, timeout: number) {
        super(`操作 "${operation}" 超时 (${timeout}ms)`);
        this.name = 'NetworkTimeoutError';
        this.operation = operation;
        this.timeout = timeout;

        Object.setPrototypeOf(this, NetworkTimeoutError.prototype);
    }
}

export class NetworkRequestClient {
    private readonly defaultTimeout = 10000;
    private readonly defaultMaxRetries = 3;

    async fetchWithRetry(
        url: string,
        options: NetworkRequestOptions = {},
        maxRetries = options.maxRetries ?? this.defaultMaxRetries
    ): Promise<Response> {
        this.assertURL(url);
        this.assertNumber(maxRetries, 'maxRetries');

        const {timeout = this.defaultTimeout, maxRetries: _ignoredMaxRetries, ...fetchOptions} = options;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🌐 Network: 网络请求 (尝试 ${attempt}/${maxRetries}): ${url}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new NetworkRequestError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        url,
                        response.status,
                        attempt
                    );
                }

                console.log(`🌐 Network: 网络请求成功: ${url}`);
                return response;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`⚠️ Network: 网络请求失败 (尝试 ${attempt}/${maxRetries}): ${message}`);

                if (this.isAbortError(error)) {
                    if (attempt === maxRetries) {
                        throw new NetworkTimeoutError('fetch request', timeout);
                    }
                } else if (attempt === maxRetries) {
                    console.error(`🚫 Network: 网络请求最终失败: ${url}`);
                    if (error instanceof NetworkRequestError) {
                        throw error;
                    }
                    throw new NetworkRequestError(message || 'Unknown error', url);
                }

                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`⏳ Network: ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new NetworkRequestError('Max retries exceeded', url);
    }

    private assertURL(value: string): void {
        try {
            new URL(value);
        } catch {
            throw new Error(`无效的 URL: ${value}`);
        }
    }

    private assertNumber(value: number, name: string): void {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error(`${name} 必须是有效数字`);
        }
    }

    private isAbortError(error: unknown): boolean {
        return error instanceof Error && error.name === 'AbortError';
    }
}

export const networkRequestClient = new NetworkRequestClient();
