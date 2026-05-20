/**
 * Navigation API - 导航 API
 * 提供应用内导航功能
 */

import {validate} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {extensionHostService} from "@/features/extensions/service";
import {ExtensionContext} from "@extensions/core";
import {NavigationAPI} from "@extensions/api/types/navigation";

/**
 * 创建导航 API
 * @param {ExtensionContext} _context - 扩展上下文
 * @returns {NavigationAPI} 导航 API 实例
 */
export function createNavigationAPI(_context: ExtensionContext): NavigationAPI {
    return {
        navigateToView(viewId: string): void {
            validate.viewId(viewId);

            return ErrorUtils.wrapSync(() => {
                try {
                    extensionHostService.navigateToView(viewId);
                } catch (_error) {
                    throw new NotAvailableError('navigation.navigateTo', '导航组件不可用');
                }
            }, 'navigation.navigateTo');
        },

        goBack(): void {
            return ErrorUtils.wrapSync(() => {
                //TODO
                console.log('暂未实现');
            }, 'navigation.goBack');
        },

        goForward(): void {
            return ErrorUtils.wrapSync(() => {
                //TODO
                console.log('暂未实现');
            }, 'navigation.goForward');
        },

        getCurrentView(): string | null {
            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getCurrentView();
            }, 'navigation.getCurrentView');
        }
    };
}
