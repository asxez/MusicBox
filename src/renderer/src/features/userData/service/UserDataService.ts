import {userDataGateway} from '@/infrastructure/electron';
import type {
    DiaryData,
    DiaryHistory,
    MoodData,
    MoodHistory,
    SaveDiaryResult,
    SaveMoodResult
} from '@api/types/userdata';

export class UserDataService {
    async getMoodHistory(): Promise<MoodHistory> {
        try {
            return await userDataGateway.getMoodHistory() as MoodHistory || [];
        } catch (error) {
            console.error('❌ UserDataService: 获取心情历史失败', error);
            return [];
        }
    }

    async saveMood(moodData: MoodData): Promise<SaveMoodResult> {
        try {
            const result = await userDataGateway.saveMood(moodData) as SaveMoodResult | null;
            return result || {success: true, data: moodData};
        } catch (error) {
            console.error('❌ UserDataService: 保存心情记录失败', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async getDiaryHistory(): Promise<DiaryHistory> {
        try {
            return await userDataGateway.getDiaryHistory() as DiaryHistory || [];
        } catch (error) {
            console.error('❌ UserDataService: 获取日记历史失败', error);
            return [];
        }
    }

    async saveDiary(diaryData: DiaryData): Promise<SaveDiaryResult> {
        try {
            const result = await userDataGateway.saveDiary(diaryData) as SaveDiaryResult | null;
            return result || {success: true, data: diaryData};
        } catch (error) {
            console.error('❌ UserDataService: 保存日记记录失败', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }
}

export const userDataService = new UserDataService();
