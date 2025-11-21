export interface WindowAPI {
    /**
     * 窗口最大化
     */
    maximize(): Promise<void>;

    /**
     * 窗口最小化
     */
    minimize(): Promise<void>;

    /**
     * 关闭窗口
     */
    close(): Promise<void>;

    /**
     * 窗口是否最大化
     */
    isMaximized(): Promise<boolean>;

    /**
     * 获取窗口位置
     */
    getPosition(): Promise<[number, number]>;

    /**
     * 获取窗口大小
     */
    getSize(): Promise<[number, number]>;

    /**
     * 设置窗口大小
     */
    setSize(width: number, height: number): Promise<any>;

    /**
     * 监听窗口最大化
     */
    onMaximizedChanged(callback: (isMaximized: boolean) => void): Promise<void>;
}
