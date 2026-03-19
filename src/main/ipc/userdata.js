// 用户数据相关 IPC

const fs = require('fs');
const path = require('path');

async function readJsonFile(filePath, defaultValue) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`⚠️ 读取文件失败 ${filePath}:`, error);
        }
        return defaultValue;
    }
}

async function writeJsonFile(filePath, data) {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 注册用户数据 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {Electron.App} deps.app
 */
function registerUserDataIpcHandlers({ipcMain, app}) {
    if (!ipcMain) throw new Error('registerUserDataIpcHandlers: 缺少 ipcMain');
    if (!app) throw new Error('registerUserDataIpcHandlers: 缺少 app');

    const userDataPath = app.getPath('userData');
    const moodFilePath = path.join(userDataPath, 'mood-history.json');
    const diaryFilePath = path.join(userDataPath, 'diary-history.json');

    // 读取心情历史
    ipcMain.handle('userdata:getMoodHistory', async () => {
        return readJsonFile(moodFilePath, []);
    });

    // 保存心情记录
    ipcMain.handle('userdata:saveMood', async (event, moodData) => {
        try {
            let history = await readJsonFile(moodFilePath, []);
            history.push({...moodData, timestamp: Date.now()});
            // 只保留最近500条记录
            if (history.length > 500) history = history.slice(-500);
            await writeJsonFile(moodFilePath, history);
            return {success: true};
        } catch (error) {
            console.error('❌ 保存心情记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 读取日记历史
    ipcMain.handle('userdata:getDiaryHistory', async () => {
        return readJsonFile(diaryFilePath, []);
    });

    // 保存日记记录
    ipcMain.handle('userdata:saveDiary', async (event, diaryData) => {
        try {
            let history = await readJsonFile(diaryFilePath, []);
            history.push({...diaryData, timestamp: Date.now()});
            await writeJsonFile(diaryFilePath, history);
            return {success: true};
        } catch (error) {
            console.error('❌ 保存日记记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 删除心情记录
    ipcMain.handle('userdata:deleteMood', async (event, timestamp) => {
        try {
            let history = await readJsonFile(moodFilePath, null);
            if (!history) return {success: false, error: '文件不存在'};
            history = history.filter(item => item.timestamp !== timestamp);
            await writeJsonFile(moodFilePath, history);
            return {success: true};
        } catch (error) {
            console.error('❌ 删除心情记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 删除日记记录
    ipcMain.handle('userdata:deleteDiary', async (event, timestamp) => {
        try {
            let history = await readJsonFile(diaryFilePath, null);
            if (!history) return {success: false, error: '文件不存在'};
            history = history.filter(item => item.timestamp !== timestamp);
            await writeJsonFile(diaryFilePath, history);
            return {success: true};
        } catch (error) {
            console.error('❌ 删除日记记录失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerUserDataIpcHandlers,
};
