/**
 * Navigation API - 导航 API
 * 提供应用内导航功能
 */

import {validate} from './common/validation.js';
import {ErrorUtils, NotAvailableError} from './common/errors.js';
import {app} from '@core/app';

/**
 * 创建导航 API
 * @param {Object} context - 扩展上下文
 * @returns {NavigationAPI} 导航 API 实例
 */
export function createNavigationAPI(context) {
    return {
        /**
         * 导航到视图
         * @param {string} viewId - 视图 ID
         * @returns {*}
         */
        navigateToView(viewId) {
            validate.viewId(viewId);

            return ErrorUtils.wrapSync(() => {
                if (app && app.components && app.components.navigation) {
                    app.components.navigation.navigateToView(viewId);
                } else {
                    throw new NotAvailableError('navigation.navigateTo', '导航组件不可用');
                }
            }, 'navigation.navigateTo');
        },

        /**
         * 返回上一个视图
         * @returns {*}
         */
        goBack() {
            return ErrorUtils.wrapSync(() => {
                //TODO
                console.log('暂未实现');
            }, 'navigation.goBack');
        },

        /**
         * 前进到下一个视图
         * @returns {*}
         */
        goForward() {
            return ErrorUtils.wrapSync(() => {
                //TODO
                console.log('暂未实现');
            }, 'navigation.goForward');
        },

        /**
         * 获取当前视图 ID
         * @returns {string|null} 当前视图 ID
         */
        getCurrentView() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.currentView) {
                    return app.currentView;
                }
                return null;
            }, 'navigation.getCurrentView');
        }
    };
}
