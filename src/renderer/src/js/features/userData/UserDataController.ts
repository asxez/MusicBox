import type {
    DiaryData,
    DiaryHistory,
    MoodData,
    MoodHistory,
    SaveDiaryResult,
    SaveMoodResult
} from '@api/types/userdata';
import {userDataService} from './service';

class UserDataController {
    async getMoodHistory(): Promise<MoodHistory> {
        return await userDataService.getMoodHistory();
    }

    async saveMood(moodData: MoodData): Promise<SaveMoodResult> {
        return await userDataService.saveMood(moodData);
    }

    async getDiaryHistory(): Promise<DiaryHistory> {
        return await userDataService.getDiaryHistory();
    }

    async saveDiary(diaryData: DiaryData): Promise<SaveDiaryResult> {
        return await userDataService.saveDiary(diaryData);
    }
}

export const userDataController = new UserDataController();
export {UserDataController};
