export interface SystemAPI {
    /**
     * 获取应用版本
     */
    getVersion(): Promise<string>;

    /**
     * 获取平台信息
     */
    getPlatform(): Promise<string>;

    /**
     * 获取操作系统类型
     */
    getOS(): Promise<string>;

    /**
     * 获取应用路径
     */
    getAppPath(): Promise<string>;

    /**
     * 获取用户数据路径
     */
    getUserDataPath(): Promise<string>;

    /**
     * 获取临时目录路径
     */
    getTempPath(): Promise<string>;

    /**
     * 获取系统语言
     */
    getLanguage(): string;

    /**
     * 获取环境变量
     */
    getEnv(key: string): string | undefined;

    /**
     * 显示文件在文件管理器中
     */
    showItemInFolder(filePath: string): Promise<void>;

    /**
     * 获取剪贴板文本
     */
    getClipboardText(): Promise<string>;

    /**
     * 设置剪贴板文本
     */
    setClipboardText(text: string): Promise<void>;
}
