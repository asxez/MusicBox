/**
 * 外部 JavaScript 模块的类型声明
 */

import { MusicBoxApp, MusicBoxAPI } from './types';

declare module '@core/app' {
    export const app: MusicBoxApp;
}

declare module '@api/api' {
    export const api: MusicBoxAPI;
}
