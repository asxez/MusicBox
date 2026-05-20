import {CancellationToken, Task, TaskState} from "@extensions/api";

export type TaskStateValue = typeof TaskState[keyof typeof TaskState];

export interface TaskOptions {
    cancellable?: boolean;
    showProgress?: boolean;
}

export interface ProgressReport {
    increment?: number;
    message?: string;
}

export interface ProgressReporter {
    report(value: number | ProgressReport): void;
}

export interface ProgressChangeEvent {
    progress: number;
    message: string;
}

export interface TasksAPI {
    /**
     * 创建任务
     */
    createTask(title: string, executor: (progress: ProgressReporter, token: CancellationToken) => Promise<any>, options?: TaskOptions): Task;

    /**
     * 获取所有任务
     */
    getTasks(): Task[];

    /**
     * 根据 ID 获取任务
     */
    getTask(taskId: string): Task | null;

    /**
     * 取消所有任务
     */
    cancelAll(): void;
}
