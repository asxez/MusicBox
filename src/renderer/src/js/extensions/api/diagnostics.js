/**
 * Diagnostics API - 诊断 API
 * 提供错误、警告等诊断信息的管理功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';
import {Disposable} from '../core/Lifecycle.js';

/**
 * 诊断严重级别
 */
export const DiagnosticSeverity = {
    ERROR: 0,
    WARNING: 1,
    INFORMATION: 2,
    HINT: 3
};

/**
 * 全局诊断集合注册表
 */
const globalDiagnosticCollections = new Map();

/**
 * 创建诊断 API
 * @param {Object} context - 扩展上下文
 * @returns {DiagnosticsAPI} 诊断 API 实例
 */
export function createDiagnosticsAPI(context) {
    return {
        /**
         * 创建诊断集合
         * @param {string} name - 集合名称
         * @returns {DiagnosticCollection} 诊断集合对象
         */
        createDiagnosticCollection(name) {
            Validator.assertNonEmptyString(name, 'name');

            return ErrorUtils.wrapSync(() => {
                if (globalDiagnosticCollections.has(name)) {
                    console.warn(`⚠️ 诊断集合 ${name} 已存在，将返回现有集合`);
                    return globalDiagnosticCollections.get(name);
                }

                const collection = new DiagnosticCollection(name);
                globalDiagnosticCollections.set(name, collection);

                console.log(`✅ 诊断集合已创建: ${name}`);

                return collection;
            }, 'diagnostics.createDiagnosticCollection');
        },

        /**
         * 获取所有诊断集合
         * @returns {Array<DiagnosticCollection>} 诊断集合列表
         */
        getDiagnosticCollections() {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalDiagnosticCollections.values());
            }, 'diagnostics.getDiagnosticCollections');
        }
    };
}

/**
 * 诊断集合类
 */
class DiagnosticCollection extends Disposable {
    constructor(name) {
        super();
        this.name = name;
        this.diagnostics = new Map(); // uri -> Diagnostic[]
    }

    /**
     * 设置诊断信息
     * @param {string} uri - 资源 URI
     * @param {Array<Diagnostic>} diagnostics - 诊断信息列表
     */
    set(uri, diagnostics) {
        Validator.assertNonEmptyString(uri, 'uri');

        if (diagnostics === undefined || diagnostics === null) {
            this.diagnostics.delete(uri);
        } else {
            Validator.assertArray(diagnostics, 'diagnostics');
            this.diagnostics.set(uri, [...diagnostics]);
        }

        this._notifyChange();
    }

    /**
     * 删除诊断信息
     * @param {string} uri - 资源 URI
     */
    delete(uri) {
        Validator.assertNonEmptyString(uri, 'uri');
        this.diagnostics.delete(uri);
        this._notifyChange();
    }

    /**
     * 清空所有诊断信息
     */
    clear() {
        this.diagnostics.clear();
        this._notifyChange();
    }

    /**
     * 获取诊断信息
     * @param {string} uri - 资源 URI
     * @returns {Array<Diagnostic>} 诊断信息列表
     */
    get(uri) {
        Validator.assertNonEmptyString(uri, 'uri');
        return this.diagnostics.get(uri) || [];
    }

    /**
     * 检查是否有诊断信息
     * @param {string} uri - 资源 URI
     * @returns {boolean} 是否有诊断信息
     */
    has(uri) {
        Validator.assertNonEmptyString(uri, 'uri');
        return this.diagnostics.has(uri);
    }

    /**
     * 遍历所有诊断信息
     * @param {Function} callback - 回调函数 (uri, diagnostics) => void
     */
    forEach(callback) {
        Validator.assertFunction(callback, 'callback');
        this.diagnostics.forEach((diagnostics, uri) => {
            callback(uri, diagnostics);
        });
    }

    /**
     * 获取所有 URI
     * @returns {Array<string>} URI 列表
     */
    getUris() {
        return Array.from(this.diagnostics.keys());
    }

    /**
     * 获取诊断总数
     * @returns {number} 诊断总数
     */
    getCount() {
        let count = 0;
        this.diagnostics.forEach(diagnostics => {
            count += diagnostics.length;
        });
        return count;
    }

    /**
     * 通知诊断变化
     * @private
     */
    _notifyChange() {
        // TODO: 触发诊断变化事件
        console.log(`[DiagnosticCollection] ${this.name}: ${this.getCount()} 个诊断`);
    }

    /**
     * 释放资源
     */
    dispose() {
        this.clear();
        globalDiagnosticCollections.delete(this.name);
        super.dispose();
        console.log(`🗑️ 诊断集合已释放: ${this.name}`);
    }
}

/**
 * 诊断类
 */
class Diagnostic {
    /**
     * @param {Object} range - 范围对象 {start: {line, character}, end: {line, character}}
     * @param {string} message - 诊断消息
     * @param {number} [severity=DiagnosticSeverity.ERROR] - 严重级别
     */
    constructor(range, message, severity = DiagnosticSeverity.ERROR) {
        this.range = range;
        this.message = message;
        this.severity = severity;
        this.source = '';
        this.code = '';
        this.relatedInformation = [];
    }
}

/**
 * 创建诊断对象的辅助函数
 */
export function createDiagnostic(range, message, severity) {
    return new Diagnostic(range, message, severity);
}

export {DiagnosticCollection, Diagnostic, globalDiagnosticCollections};
