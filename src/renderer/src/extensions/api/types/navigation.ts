/**
 * 导航 API 接口
 */
export interface NavigationAPI {
    /**
     * 导航到视图
     * @param {string} viewId - 视图 ID
     * @returns {void}
     */
    navigateToView(viewId: string): void;

    /**
     * 返回上一个视图
     * @returns {void}
     */
    goBack(): void;

    /**
     * 前进到下一个视图
     * @returns {void}
     */
    goForward(): void;

    /**
     * 获取当前视图 ID
     * @returns {string|null} 当前视图 ID
     */
    getCurrentView(): string | null;
}
