/**
 * 用户数据 API
 * 提供用户心情和日记数据的管理功能
 */


import {userDataGateway} from '@js/infrastructure/electron';
import {BaseAPI, Validator} from "@api/core";
import {
    DeleteResult,
    DiaryData,
    DiaryHistory,
    MoodData,
    MoodHistory,
    SaveDiaryResult,
    SaveMoodResult
} from "@api/types";

/**
 * 用户数据 API 类
 */
export class UserDataAPI extends BaseAPI {
    constructor() {
        super('UserDataAPI');
    }

    /**
     * 获取心情历史记录
     * @returns 心情历史记录数组
     */
    async getMoodHistory(): Promise<MoodHistory> {
        return this.wrapIPC(async () => {
            const history = await userDataGateway.getMoodHistory();
            return history || [];
        }, 'userdata.getMoodHistory', []);
    }

    /**
     * 保存心情记录
     * @param moodData - 心情数据
     * @returns 保存结果
     */
    async saveMood(moodData: MoodData): Promise<SaveMoodResult> {
        Validator.assertObject(moodData, 'moodData');
        Validator.assertObjectHasProps(moodData, ['mood'], 'moodData');

        try {
            const result = await this.wrapIPC(
                () => userDataGateway.saveMood(moodData),
                'userdata.saveMood'
            );

            return result || {success: true, data: moodData};
        } catch (error) {
            this.logError('保存心情记录失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 获取日记历史记录
     * @returns 日记历史记录数组
     */
    async getDiaryHistory(): Promise<DiaryHistory> {
        return this.wrapIPC(async () => {
            const history = await userDataGateway.getDiaryHistory();
            return history || [];
        }, 'userdata.getDiaryHistory', []);
    }

    /**
     * 保存日记记录
     * @param diaryData - 日记数据
     * @returns 保存结果
     */
    async saveDiary(diaryData: DiaryData): Promise<SaveDiaryResult> {
        Validator.assertObject(diaryData, 'diaryData');
        Validator.assertObjectHasProps(diaryData, ['content'], 'diaryData');

        try {
            const result = await this.wrapIPC(
                () => userDataGateway.saveDiary(diaryData),
                'userdata.saveDiary'
            );

            return result || {success: true, data: diaryData};
        } catch (error) {
            this.logError('保存日记记录失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 删除心情记录
     * @param timestamp - 心情记录的时间戳
     * @returns 删除结果
     */
    async deleteMood(timestamp: number): Promise<DeleteResult> {
        Validator.assertNumber(timestamp, 'timestamp');

        try {
            const result = await this.wrapIPC(
                () => userDataGateway.deleteMood(timestamp),
                'userdata.deleteMood'
            );

            return result || {success: true};
        } catch (error) {
            this.logError('删除心情记录失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 删除日记记录
     * @param timestamp - 日记记录的时间戳
     * @returns 删除结果
     */
    async deleteDiary(timestamp: number): Promise<DeleteResult> {
        Validator.assertNumber(timestamp, 'timestamp');

        try {
            const result = await this.wrapIPC(
                () => userDataGateway.deleteDiary(timestamp),
                'userdata.deleteDiary'
            );

            return result || {success: true};
        } catch (error) {
            this.logError('删除日记记录失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }
}

export const userDataAPI = new UserDataAPI();
