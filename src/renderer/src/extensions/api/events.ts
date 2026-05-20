/**
 * Events API - 事件 API
 * 提供应用事件的监听和触发功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import {extensionHostService} from "@/features/extensions/service";
import {ExtensionContext} from "@extensions/core";
import {EventCallback, EventsAPI} from "@extensions/api/types/events";

/**
 * 创建事件 API
 * @param _context - 扩展上下文
 * @returns 事件 API 实例
 */
export function createEventsAPI(_context: ExtensionContext): EventsAPI {
    return {
        on(eventName: string, callback: EventCallback): IDisposable {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                extensionHostService.on(eventName, callback);
                return toDisposable(() => {
                    extensionHostService.off(eventName, callback);
                });
            }, 'events.on');
        },

        once(eventName: string, callback: EventCallback): IDisposable {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                let disposed = false;
                const wrappedCallback = (...args: any[]) => {
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

        emit(eventName: string, data?: any): void {
            Validator.assertNonEmptyString(eventName, 'eventName');

            return ErrorUtils.wrapSync(() => {
                extensionHostService.emit(eventName, data);
            }, 'events.emit');
        },

        off(eventName: string, callback: EventCallback): void {
            Validator.assertNonEmptyString(eventName, 'eventName');
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                extensionHostService.off(eventName, callback);
            }, 'events.off');
        },

        removeAllListeners(eventName?: string): void {
            if (eventName !== undefined) {
                Validator.assertNonEmptyString(eventName, 'eventName');
            }

            return ErrorUtils.wrapSync(() => {
                extensionHostService.removeAllListeners(eventName);
            }, 'events.removeAllListeners');
        }
    };
}
