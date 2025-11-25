/**
 * 用户数据 API 类型定义
 */


import {Result, Timestamp} from "@api/types/common";

/**
 * 心情数据
 */
export interface MoodData {
    timestamp: Timestamp;
    mood: string;
    note?: string;
    tags?: string[];
}

/**
 * 日记数据
 */
export interface DiaryData {
    timestamp: Timestamp;
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
}

/**
 * 心情历史记录
 */
export type MoodHistory = MoodData[];

/**
 * 日记历史记录
 */
export type DiaryHistory = DiaryData[];

/**
 * 保存心情结果
 */
export type SaveMoodResult = Result<MoodData>;

/**
 * 保存日记结果
 */
export type SaveDiaryResult = Result<DiaryData>;

/**
 * 删除记录结果
 */
export type DeleteResult = Result;
