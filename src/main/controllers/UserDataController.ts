// 用户数据控制器

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code !== 'ENOENT') console.error(`⚠️ 读取文件失败 ${filePath}:`, error);
        return defaultValue;
    }
}

async function writeJsonFile(filePath: string, data: any): Promise<void> {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

@Controller('userdata')
export class UserDataController extends BaseController {
    private moodFilePath: string;
    private diaryFilePath: string;

    constructor() {
        super();
        const userDataPath = app.getPath('userData');
        this.moodFilePath = path.join(userDataPath, 'mood-history.json');
        this.diaryFilePath = path.join(userDataPath, 'diary-history.json');
    }

    @IpcHandle('userdata:getMoodHistory')
    async getMoodHistory(): Promise<any[]> {
        return readJsonFile(this.moodFilePath, []);
    }

    @IpcHandle('userdata:saveMood')
    async saveMood(moodData: any): Promise<{ success: boolean; error?: string }> {
        try {
            let history: any[] = await readJsonFile(this.moodFilePath, []);
            history.push({...moodData, timestamp: Date.now()});
            if (history.length > 500) history = history.slice(-500);
            await writeJsonFile(this.moodFilePath, history);
            return {success: true};
        } catch (error: any) {
            console.error('❌ 保存心情记录失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('userdata:getDiaryHistory')
    async getDiaryHistory(): Promise<any[]> {
        return readJsonFile(this.diaryFilePath, []);
    }

    @IpcHandle('userdata:saveDiary')
    async saveDiary(diaryData: any): Promise<{ success: boolean; error?: string }> {
        try {
            let history: any[] = await readJsonFile(this.diaryFilePath, []);
            history.push({...diaryData, timestamp: Date.now()});
            if (history.length > 200) history = history.slice(-200);
            await writeJsonFile(this.diaryFilePath, history);
            return {success: true};
        } catch (error: any) {
            console.error('❌ 保存日记记录失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('userdata:deleteMood')
    async deleteMood(timestamp: number): Promise<{ success: boolean; error?: string }> {
        try {
            const history = await readJsonFile<any[] | null>(this.moodFilePath, null);
            if (!history) return {success: false, error: '文件不存在'};
            const updated = history.filter((item: any) => item.timestamp !== timestamp);
            await writeJsonFile(this.moodFilePath, updated);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('userdata:deleteDiary')
    async deleteDiary(timestamp: number): Promise<{ success: boolean; error?: string }> {
        try {
            const history = await readJsonFile<any[] | null>(this.diaryFilePath, null);
            if (!history) return {success: false, error: '文件不存在'};
            const updated = history.filter((item: any) => item.timestamp !== timestamp);
            await writeJsonFile(this.diaryFilePath, updated);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }
}
