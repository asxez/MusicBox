/**
 * Tasks API - 任务 API
 * 提供后台任务的创建和管理功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';
import {Disposable} from '../core/Lifecycle.js';
import {Emitter} from '../core/Event.js';

/**
 * 任务状态
 */
export const TaskState = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * 全局任务注册表
 */
const globalTasks = new Map();

/**
 * 创建任务 API
 * @param {Object} context - 扩展上下文
 * @returns {TasksAPI} 任务 API 实例
 */
export function createTasksAPI(context) {
    return {
        /**
         * 创建任务
         * @param {string} title - 任务标题
         * @param {Function} executor - 任务执行函数
         * @param {Object} [options={}] - 任务选项
         * @returns {Task} 任务对象
         */
        createTask(title, executor, options = {}) {
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

        /**
         * 获取所有任务
         * @returns {Array<Task>} 任务列表
         */
        getTasks() {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalTasks.values());
            }, 'tasks.getTasks');
        },

        /**
         * 根据 ID 获取任务
         * @param {string} taskId - 任务 ID
         * @returns {Task|null} 任务对象
         */
        getTask(taskId) {
            Validator.assertNonEmptyString(taskId, 'taskId');

            return ErrorUtils.wrapSync(() => {
                return globalTasks.get(taskId) || null;
            }, 'tasks.getTask');
        },

        /**
         * 取消所有任务
         * @returns {void}
         */
        cancelAll() {
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

/**
 * 任务类
 */
class Task extends Disposable {
    constructor(title, executor, options) {
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

        this._onDidChangeState = new Emitter();
        this._onDidChangeProgress = new Emitter();
        this._cancellationToken = new CancellationToken();
    }

    /**
     * 状态变化事件
     */
    get onDidChangeState() {
        return this._onDidChangeState.event;
    }

    /**
     * 进度变化事件
     */
    get onDidChangeProgress() {
        return this._onDidChangeProgress.event;
    }

    /**
     * 执行任务
     * @returns {Promise<*>} 任务结果
     */
    async execute() {
        if (this.state !== TaskState.PENDING) {
            throw new Error(`任务 ${this.id} 已经执行过`);
        }

        this._setState(TaskState.RUNNING);

        try {
            const progressReporter = {
                report: (value) => {
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
            this.error = error;
            this._setState(TaskState.FAILED);
            throw error;
        }
    }

    /**
     * 取消任务
     */
    cancel() {
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
     * @private
     */
    _setState(state) {
        if (this.state !== state) {
            this.state = state;
            this._onDidChangeState.fire(state);
            console.log(`[Task] ${this.id}: ${state}`);
        }
    }

    /**
     * 设置进度
     * @private
     */
    _setProgress(progress) {
        this.progress = Math.max(0, Math.min(100, progress));
        this._onDidChangeProgress.fire({progress: this.progress, message: this.message});
    }

    /**
     * 释放资源
     */
    dispose() {
        this.cancel();
        this._onDidChangeState.dispose();
        this._onDidChangeProgress.dispose();
        globalTasks.delete(this.id);
        super.dispose();
        console.log(`🗑️ 任务已释放: ${this.id}`);
    }
}

/**
 * 取消令牌类
 */
class CancellationToken {
    constructor() {
        this.isCancellationRequested = false;
        this._onCancellationRequested = new Emitter();
    }

    get onCancellationRequested() {
        return this._onCancellationRequested.event;
    }

    cancel() {
        if (!this.isCancellationRequested) {
            this.isCancellationRequested = true;
            this._onCancellationRequested.fire();
        }
    }
}

export {Task, CancellationToken, globalTasks};
