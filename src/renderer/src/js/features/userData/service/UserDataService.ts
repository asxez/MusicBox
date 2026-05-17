import {userDataAPI} from '@api/modules';
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
        return await userDataAPI.getMoodHistory();
    }

    async saveMood(moodData: MoodData): Promise<SaveMoodResult> {
        return await userDataAPI.saveMood(moodData);
    }

    async getDiaryHistory(): Promise<DiaryHistory> {
        return await userDataAPI.getDiaryHistory();
    }

    async saveDiary(diaryData: DiaryData): Promise<SaveDiaryResult> {
        return await userDataAPI.saveDiary(diaryData);
    }
}

export const userDataService = new UserDataService();
