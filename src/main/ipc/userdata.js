// 用户数据相关 IPC

/**
 * 注册用户数据 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {Electron.App} deps.app
 */
function registerUserDataIpcHandlers({ipcMain, app}) {
    if (!ipcMain) throw new Error('registerUserDataIpcHandlers: 缺少 ipcMain');
    if (!app) throw new Error('registerUserDataIpcHandlers: 缺少 app');

    const path = require('path');

    const userDataPath = app.getPath('userData');
    const moodFilePath = path.join(userDataPath, 'mood-history.json');
    const diaryFilePath = path.join(userDataPath, 'diary-history.json');

    // 读取心情历史
    ipcMain.handle('userdata:getMoodHistory', async () => {
        const fs = require('fs');
        try {
            if (fs.existsSync(moodFilePath)) {
                const data = fs.readFileSync(moodFilePath, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error('读取心情历史失败:', error);
            return [];
        }
    });

    // 保存心情记录
    ipcMain.handle('userdata:saveMood', async (event, moodData) => {
        const fs = require('fs');
        try {
            let history = [];
            if (fs.existsSync(moodFilePath)) {
                const data = fs.readFileSync(moodFilePath, 'utf8');
                history = JSON.parse(data);
            }

            history.push({
                ...moodData,
                timestamp: Date.now()
            });

            // 只保留最近500条记录
            if (history.length > 500) {
                history = history.slice(-500);
            }

            fs.writeFileSync(moodFilePath, JSON.stringify(history, null, 2), 'utf8');
            return {success: true};
        } catch (error) {
            console.error('保存心情记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 读取日记历史
    ipcMain.handle('userdata:getDiaryHistory', async () => {
        const fs = require('fs');
        try {
            if (fs.existsSync(diaryFilePath)) {
                const data = fs.readFileSync(diaryFilePath, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error('读取日记历史失败:', error);
            return [];
        }
    });

    // 保存日记记录
    ipcMain.handle('userdata:saveDiary', async (event, diaryData) => {
        const fs = require('fs');
        try {
            let history = [];
            if (fs.existsSync(diaryFilePath)) {
                const data = fs.readFileSync(diaryFilePath, 'utf8');
                history = JSON.parse(data);
            }

            history.push({
                ...diaryData,
                timestamp: Date.now()
            });

            fs.writeFileSync(diaryFilePath, JSON.stringify(history, null, 2), 'utf8');
            return {success: true};
        } catch (error) {
            console.error('保存日记记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 删除心情记录
    ipcMain.handle('userdata:deleteMood', async (event, timestamp) => {
        const fs = require('fs');
        try {
            if (!fs.existsSync(moodFilePath)) {
                return {success: false, error: '文件不存在'};
            }

            const data = fs.readFileSync(moodFilePath, 'utf8');
            let history = JSON.parse(data);
            history = history.filter(item => item.timestamp !== timestamp);

            fs.writeFileSync(moodFilePath, JSON.stringify(history, null, 2), 'utf8');
            return {success: true};
        } catch (error) {
            console.error('删除心情记录失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 删除日记记录
    ipcMain.handle('userdata:deleteDiary', async (event, timestamp) => {
        const fs = require('fs');
        try {
            if (!fs.existsSync(diaryFilePath)) {
                return {success: false, error: '文件不存在'};
            }

            const data = fs.readFileSync(diaryFilePath, 'utf8');
            let history = JSON.parse(data);
            history = history.filter(item => item.timestamp !== timestamp);

            fs.writeFileSync(diaryFilePath, JSON.stringify(history, null, 2), 'utf8');
            return {success: true};
        } catch (error) {
            console.error('删除日记记录失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerUserDataIpcHandlers,
};
