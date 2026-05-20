/**
 * Diagnostics API - 诊断 API
 * 提供错误、警告等诊断信息的管理功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {Disposable} from '@extensions/core/Lifecycle';
import {ExtensionContext} from "@extensions/core/ExtensionActivator";
import {DiagnosticRelatedInformation, DiagnosticsAPI, DiagnosticSeverityValue} from "@extensions/api/types/diagnostics";

/**
 * 诊断严重级别
 */
export const DiagnosticSeverity = {
    ERROR: 0,
    WARNING: 1,
    INFORMATION: 2,
    HINT: 3
} as const;

/**
 * 诊断类
 */
export class Diagnostic {
    range: Range;
    message: string;
    severity: DiagnosticSeverityValue;
    source: string;
    code: string;
    relatedInformation: DiagnosticRelatedInformation[];

    constructor(range: Range, message: string, severity: DiagnosticSeverityValue = DiagnosticSeverity.ERROR) {
        this.range = range;
        this.message = message;
        this.severity = severity;
        this.source = '';
        this.code = '';
        this.relatedInformation = [];
    }
}

/**
 * 诊断集合类
 */
export class DiagnosticCollection extends Disposable {
    name: string;
    private diagnostics: Map<string, Diagnostic[]>;

    constructor(name: string) {
        super();
        this.name = name;
        this.diagnostics = new Map();
    }

    /**
     * 设置诊断信息
     */
    set(uri: string, diagnostics: Diagnostic[] | undefined | null): void {
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
     */
    delete(uri: string): void {
        Validator.assertNonEmptyString(uri, 'uri');
        this.diagnostics.delete(uri);
        this._notifyChange();
    }

    /**
     * 清空所有诊断信息
     */
    clear(): void {
        this.diagnostics.clear();
        this._notifyChange();
    }

    /**
     * 获取诊断信息
     */
    get(uri: string): Diagnostic[] {
        Validator.assertNonEmptyString(uri, 'uri');
        return this.diagnostics.get(uri) || [];
    }

    /**
     * 检查是否有诊断信息
     */
    has(uri: string): boolean {
        Validator.assertNonEmptyString(uri, 'uri');
        return this.diagnostics.has(uri);
    }

    /**
     * 遍历所有诊断信息
     */
    forEach(callback: (uri: string, diagnostics: Diagnostic[]) => void): void {
        Validator.assertFunction(callback, 'callback');
        this.diagnostics.forEach((diagnostics, uri) => {
            callback(uri, diagnostics);
        });
    }

    /**
     * 获取所有 URI
     */
    getUris(): string[] {
        return Array.from(this.diagnostics.keys());
    }

    /**
     * 获取诊断总数
     */
    getCount(): number {
        let count = 0;
        this.diagnostics.forEach(diagnostics => {
            count += diagnostics.length;
        });
        return count;
    }

    /**
     * 通知诊断变化
     */
    private _notifyChange(): void {
        // TODO: 触发诊断变化事件
        console.log(`[DiagnosticCollection] ${this.name}: ${this.getCount()} 个诊断`);
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.clear();
        globalDiagnosticCollections.delete(this.name);
        super.dispose();
        console.log(`🗑️ 诊断集合已释放: ${this.name}`);
    }
}

/**
 * 全局诊断集合注册表
 */
export const globalDiagnosticCollections = new Map<string, DiagnosticCollection>();

/**
 * 创建诊断 API
 */
export function createDiagnosticsAPI(_context: ExtensionContext): DiagnosticsAPI {
    return {
        createDiagnosticCollection(name: string): DiagnosticCollection {
            Validator.assertNonEmptyString(name, 'name');

            return ErrorUtils.wrapSync(() => {
                if (globalDiagnosticCollections.has(name)) {
                    console.warn(`⚠️ 诊断集合 ${name} 已存在，将返回现有集合`);
                    return globalDiagnosticCollections.get(name)!;
                }

                const collection = new DiagnosticCollection(name);
                globalDiagnosticCollections.set(name, collection);

                console.log(`✅ 诊断集合已创建: ${name}`);

                return collection;
            }, 'diagnostics.createDiagnosticCollection');
        },

        getDiagnosticCollections(): DiagnosticCollection[] {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalDiagnosticCollections.values());
            }, 'diagnostics.getDiagnosticCollections');
        }
    };
}

/**
 * 创建诊断对象的辅助函数
 */
export function createDiagnostic(range: Range, message: string, severity?: DiagnosticSeverityValue): Diagnostic {
    return new Diagnostic(range, message, severity);
}
