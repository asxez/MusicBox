/**
 * Events API - 事件 API
 * 提供应用事件的监听和触发功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils, NotAvailableError} from './common/errors.js';
import {toDisposable, Disposable} from '../core/Lifecycle.js';
import {app} from '@js/app';

/**
 * 创建事件 API
 * @param {Object} context - 扩展上下文
 * @returns {EventsAPI} 事件 API 实例
 */
export function createEventsAPI(context) {
    return {
        /**
         * 监听事件
         * @param {string} eventName - 事件名
         * @param {Function} callback - 回调函数
         * @returns {Disposable} 可释放对象
         */
        on(eventName, callback) {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                if (app && typeof app.on === 'function') {
                    app.on(eventName, callback);
                    return toDisposable(() => {
                        if (app && typeof app.off === 'function') {
                            app.off(eventName, callback);
                        }
                    });
                }

                console.warn(`⚠️ 应用事件系统不可用，无法监听事件: ${eventName}`);
                return Disposable.None;
            }, 'events.on');
        },

        /**
         * 监听一次性事件
         * @param {string} eventName - 事件名
         * @param {Function} callback - 回调函数
         * @returns {Disposable} 可释放对象
         */
        once(eventName, callback) {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                let disposed = false;
                const wrappedCallback = (...args) => {
                    if (!disposed) {
                        disposed = true;
                        disposable.dispose();
                        callback(...args);
                    }
                };

                const disposable = this.on(eventName, wrappedCallback);
                return disposable;
            }, 'events.once');
        },

        /**
         * 触发事件
         * @param {string} eventName - 事件名
         * @param {*} data - 数据
         * @returns {void}
         */
        emit(eventName, data) {
            Validator.assertNonEmptyString(eventName, 'eventName');

            return ErrorUtils.wrapSync(() => {
                if (app && typeof app.emit === 'function') {
                    app.emit(eventName, data);
                } else {
                    console.warn(`⚠️ 应用事件系统不可用，无法触发事件: ${eventName}`);
                }
            }, 'events.emit');
        },

        /**
         * 移除事件监听器
         * @param {string} eventName - 事件名
         * @param {Function} callback - 回调函数
         * @returns {void}
         */
        off(eventName, callback) {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                if (app && typeof app.off === 'function') {
                    app.off(eventName, callback);
                } else {
                    console.warn(`⚠️ 应用事件系统不可用，无法移除监听器: ${eventName}`);
                }
            }, 'events.off');
        },

        /**
         * 移除所有事件监听器
         * @param {string} [eventName] - 事件名，如果不提供则移除所有事件的监听器
         * @returns {void}
         */
        removeAllListeners(eventName) {
            if (eventName !== undefined) {
                Validator.assertNonEmptyString(eventName, 'eventName');
            }

            return ErrorUtils.wrapSync(() => {
                if (app && typeof app.removeAllListeners === 'function') {
                    app.removeAllListeners(eventName);
                } else {
                    console.warn(`⚠️ 应用事件系统不可用，无法移除监听器`);
                }
            }, 'events.removeAllListeners');
        }
    };
}
