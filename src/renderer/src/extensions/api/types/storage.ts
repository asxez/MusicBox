/**
 * 存储 API 接口
 */
export interface StorageAPI {
    /**
     * 获取全局状态
     * @param key - 键
     * @param defaultValue - 默认值
     * @returns 存储的值
     */
    get<T = any>(key: string, defaultValue?: T): T;

    /**
     * 设置全局状态
     * @param key - 键
     * @param value - 值
     * @returns Promise<void>
     */
    update(key: string, value: any): Promise<void>;

    /**
     * 删除全局状态
     * @param key - 键
     * @returns Promise<void>
     */
    delete(key: string): Promise<void>;

    /**
     * 获取所有全局状态的键
     * @returns 键列表
     */
    keys(): string[];

    /**
     * 获取工作区状态
     * @param key - 键
     * @param defaultValue - 默认值
     * @returns 存储的值
     */
    getWorkspace<T = any>(key: string, defaultValue?: T): T;

    /**
     * 设置工作区状态
     * @param key - 键
     * @param value - 值
     * @returns Promise<void>
     */
    updateWorkspace(key: string, value: any): Promise<void>;

    /**
     * 删除工作区状态
     * @param key - 键
     * @returns Promise<void>
     */
    deleteWorkspace(key: string): Promise<void>;

    /**
     * 获取所有工作区状态的键
     * @returns 键列表
     */
    workspaceKeys(): string[];
}
