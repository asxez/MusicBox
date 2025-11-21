/**
 * Window API - 窗口 API
 * 提供窗口控制相关功能
 */

import {ErrorUtils} from '@extensions/api/common/errors';
import {Validator} from '@extensions/api/common/validation';
import '@extensions/core/types';
import {ExtensionContext} from "@extensions/core";
import {WindowAPI} from "@extensions/api/types/window";

/**
 * 创建窗口 API
 */
export function createWindowAPI(_context: ExtensionContext): WindowAPI {
    return {
        async maximize(): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.maximize();
            }, 'window.maximize');
        },

        async minimize(): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.minimize();
            }, 'window.minimize');
        },

        async close(): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.close();
            }, 'window.close');
        },

        async isMaximized(): Promise<boolean> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.isMaximized();
            }, 'window.isMaximized');
        },

        async getPosition(): Promise<[number, number]> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.getPosition();
            }, 'window.getPosition');
        },

        async getSize(): Promise<[number, number]> {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.getSize();
            }, 'window.getSize');
        },

        async setSize(width: number, height: number): Promise<any> {
            Validator.assertType(width, 'number', 'width');
            Validator.assertType(height, 'number', 'height');

            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.setSize(width, height);
            }, 'window.setSize');
        },

        async onMaximizedChanged(callback: (isMaximized: boolean) => void): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                await window.electronAPI.window.onMaximizedChanged((isMaximized: boolean) => {
                    callback(isMaximized);
                });
            }, 'window.onMaximizedChanged');
        }
    };
}
