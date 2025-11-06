/**
 * Navigation API - 导航 API
 * 提供应用内导航功能
 */

import {validate, Validator} from './common/validation.js';
import {ErrorUtils, NotAvailableError} from './common/errors.js';
import {app} from '@js/app';

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
         * @param {Object} [options={}] - 导航选项
         * @returns {void}
         */
        navigateTo(viewId, options = {}) {
            validate.viewId(viewId);
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                if (app && app.components && app.components.navigation) {
                    app.components.navigation.navigateTo(viewId, options);
                } else {
                    throw new NotAvailableError('navigation.navigateTo', '导航组件不可用');
                }
            }, 'navigation.navigateTo');
        },

        /**
         * 返回上一个视图
         * @returns {void}
         */
        goBack() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.components && app.components.navigation) {
                    if (typeof app.components.navigation.goBack === 'function') {
                        app.components.navigation.goBack();
                    } else {
                        window.history.back();
                    }
                } else {
                    window.history.back();
                }
            }, 'navigation.goBack');
        },

        /**
         * 前进到下一个视图
         * @returns {void}
         */
        goForward() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.components && app.components.navigation) {
                    if (typeof app.components.navigation.goForward === 'function') {
                        app.components.navigation.goForward();
                    } else {
                        window.history.forward();
                    }
                } else {
                    window.history.forward();
                }
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
        },

        /**
         * 获取导航历史
         * @returns {Array<string>} 导航历史
         */
        getHistory() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.components && app.components.navigation) {
                    if (typeof app.components.navigation.getHistory === 'function') {
                        return app.components.navigation.getHistory();
                    }
                }
                return [];
            }, 'navigation.getHistory');
        }
    };
}
