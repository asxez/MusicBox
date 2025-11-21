/**
 * Tasks API - 任务 API
 * 提供后台任务的创建和管理功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {Disposable} from '@extensions/core/Lifecycle';
import {Emitter, Event} from '@extensions//core/Event';
import {ExtensionContext} from "@extensions/core";
import {
    ProgressChangeEvent,
    ProgressReport,
    ProgressReporter,
    TaskOptions,
    TasksAPI,
    TaskStateValue
} from "@extensions/api/types/tasks";

/**
 * 任务状态
 */
export const TaskState = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
} as const;

/**
 * 取消令牌类
 */
export class CancellationToken {
    isCancellationRequested: boolean;
    private _onCancellationRequested: Emitter<void>;

    constructor() {
        this.isCancellationRequested = false;
        this._onCancellationRequested = new Emitter<void>();
    }

    get onCancellationRequested(): Event<void> {
        return this._onCancellationRequested.event;
    }

    cancel(): void {
        if (!this.isCancellationRequested) {
            this.isCancellationRequested = true;
            this._onCancellationRequested.fire();
        }
    }
}

/**
 * 任务类
 */
export class Task extends Disposable {
    id: string;
    title: string;
    executor: (progress: ProgressReporter, token: CancellationToken) => Promise<any>;
    cancellable: boolean;
    showProgress: boolean;
    state: TaskStateValue;
    progress: number;
    message: string;
    result: any;
    error: Error | null;

    private _onDidChangeState: Emitter<TaskStateValue>;
    private _onDidChangeProgress: Emitter<ProgressChangeEvent>;
    private _cancellationToken: CancellationToken;

    constructor(title: string, executor: (progress: ProgressReporter, token: CancellationToken) => Promise<any>, options: TaskOptions) {
        super();
        this.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = title;
        this.executor = executor;
        this.cancellable = options.cancellable !== false;
        this.showProgress = options.showProgress !== false;

        this.state = TaskState.PENDING;
        this.progress = 0;
        this.message = '';
        this.result = null;
        this.error = null;

        this._onDidChangeState = new Emitter<TaskStateValue>();
        this._onDidChangeProgress = new Emitter<ProgressChangeEvent>();
        this._cancellationToken = new CancellationToken();
    }

    /**
     * 状态变化事件
     */
    get onDidChangeState(): Event<TaskStateValue> {
        return this._onDidChangeState.event;
    }

    /**
     * 进度变化事件
     */
    get onDidChangeProgress(): Event<ProgressChangeEvent> {
        return this._onDidChangeProgress.event;
    }

    /**
     * 执行任务
     */
    async execute(): Promise<any> {
        if (this.state !== TaskState.PENDING) {
            throw new Error(`任务 ${this.id} 已经执行过`);
        }

        this._setState(TaskState.RUNNING);

        try {
            const progressReporter: ProgressReporter = {
                report: (value: number | ProgressReport) => {
                    if (typeof value === 'number') {
                        this._setProgress(value);
                    } else if (typeof value === 'object') {
                        if (value.increment !== undefined) {
                            this._setProgress(this.progress + value.increment);
                        }
                        if (value.message !== undefined) {
                            this.message = value.message;
                            this._onDidChangeProgress.fire({progress: this.progress, message: this.message});
                        }
                    }
                }
            };

            this.result = await this.executor(progressReporter, this._cancellationToken);

            if (this._cancellationToken.isCancellationRequested) {
                this._setState(TaskState.CANCELLED);
            } else {
                this._setState(TaskState.COMPLETED);
            }

            return this.result;
        } catch (error) {
            this.error = error as Error;
            this._setState(TaskState.FAILED);
            throw error;
        }
    }

    /**
     * 取消任务
     */
    cancel(): void {
        if (!this.cancellable) {
            console.warn(`任务 ${this.id} 不可取消`);
            return;
        }

        if (this.state === TaskState.RUNNING || this.state === TaskState.PENDING) {
            this._cancellationToken.cancel();
            this._setState(TaskState.CANCELLED);
            console.log(`🚫 任务已取消: ${this.id}`);
        }
    }

    /**
     * 设置状态
     */
    private _setState(state: TaskStateValue): void {
        if (this.state !== state) {
            this.state = state;
            this._onDidChangeState.fire(state);
            console.log(`[Task] ${this.id}: ${state}`);
        }
    }

    /**
     * 设置进度
     */
    private _setProgress(progress: number): void {
        this.progress = Math.max(0, Math.min(100, progress));
        this._onDidChangeProgress.fire({progress: this.progress, message: this.message});
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.cancel();
        this._onDidChangeState.dispose();
        this._onDidChangeProgress.dispose();
        globalTasks.delete(this.id);
        super.dispose();
        console.log(`🗑️ 任务已释放: ${this.id}`);
    }
}

/**
 * 全局任务注册表
 */
export const globalTasks = new Map<string, Task>();

/**
 * 创建任务 API
 */
export function createTasksAPI(_context: ExtensionContext): TasksAPI {
    return {
        createTask(
            title: string,
            executor: (progress: ProgressReporter, token: CancellationToken) => Promise<any>,
            options: TaskOptions = {}
        ): Task {
            Validator.assertNonEmptyString(title, 'title');
            Validator.assertFunction(executor, 'executor');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                const task = new Task(title, executor, options);
                globalTasks.set(task.id, task);

                console.log(`✅ 任务已创建: ${task.id} - ${title}`);

                return task;
            }, 'tasks.createTask');
        },

        getTasks(): Task[] {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalTasks.values());
            }, 'tasks.getTasks');
        },

        getTask(taskId: string): Task | null {
            Validator.assertNonEmptyString(taskId, 'taskId');

            return ErrorUtils.wrapSync(() => {
                return globalTasks.get(taskId) || null;
            }, 'tasks.getTask');
        },

        cancelAll(): void {
            return ErrorUtils.wrapSync(() => {
                globalTasks.forEach(task => {
                    if (task.state === TaskState.RUNNING || task.state === TaskState.PENDING) {
                        task.cancel();
                    }
                });
            }, 'tasks.cancelAll');
        }
    };
}
