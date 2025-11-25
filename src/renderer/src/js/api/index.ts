/**
 * MusicBox API
 * 统一的 API 导出接口
 */


// api.js 过于庞大，暂不迁移到TypeScript


// 导出 API 实例
import {
    coverAPI,
    fileAPI,
    libraryAPI,
    lyricsAPI,
    networkAPI,
    trayAPI,
    updateAPI,
    userDataAPI,
    windowAPI
} from '@api/modules';

export {
    coverAPI,
    fileAPI,
    libraryAPI,
    lyricsAPI,
    networkAPI,
    trayAPI,
    updateAPI,
    userDataAPI,
    windowAPI
};

export const MusicBoxAPI = {
    file: fileAPI,
    userdata: userDataAPI,
    tray: trayAPI,
    window: windowAPI,
    library: libraryAPI,
    network: networkAPI,
    lyrics: lyricsAPI,
    cover: coverAPI,
    update: updateAPI
} as const;

export default MusicBoxAPI;
