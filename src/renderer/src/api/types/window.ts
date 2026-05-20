/**
 * 窗口 API 类型定义
 */

/**
 * 窗口尺寸
 */
export interface WindowSize {
    width: number;
    height: number;
}

/**
 * 窗口位置
 */
export interface WindowPosition {
    x: number;
    y: number;
}

/**
 * 窗口边界
 */
export interface WindowBounds extends WindowPosition, WindowSize {}
