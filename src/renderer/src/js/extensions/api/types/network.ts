export interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

export interface NetworkAPI {
    /**
     * 发送 HTTP 请求
     */
    fetch(url: string, options?: RequestOptions): Promise<Response>;

    /**
     * 发送 GET 请求
     */
    get(url: string, options?: RequestOptions): Promise<string>;

    /**
     * 发送 POST 请求
     */
    post(url: string, data: any, options?: RequestOptions): Promise<any>;

    /**
     * 发送 PUT 请求
     */
    put(url: string, data: any, options?: RequestOptions): Promise<any>;

    /**
     * 发送 DELETE 请求
     */
    delete(url: string, options?: RequestOptions): Promise<any>;

    /**
     * 下载文件
     */
    downloadFile(url: string, options?: RequestOptions): Promise<Blob>;
}
