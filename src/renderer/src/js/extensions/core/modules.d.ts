/**
 * 外部 JavaScript 模块的类型声明
 */

import {MusicBoxAPI} from './types';

declare module '@api/api' {
    export const api: MusicBoxAPI;
}
