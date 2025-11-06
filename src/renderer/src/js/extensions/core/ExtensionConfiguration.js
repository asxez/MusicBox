/**
 * ExtensionConfiguration - 扩展配置系统
 * 提供配置管理、验证和持久化功能
 */

import {Disposable} from "@extensions/core/Lifecycle";
import {Emitter} from "@extensions/core/Event";

/**
 * 配置作用域
 */
export const ConfigurationScope = {
    APPLICATION: 'application',  // 全局配置
    WINDOW: 'window',           // 窗口级配置
    RESOURCE: 'resource'        // 资源级配置
};

/**
 * 配置验证器
 */
export class ConfigurationValidator {
    /**
     * 验证配置值
     * @param {*} value - 配置值
     * @param {Object} schema - JSON Schema
     * @returns {{valid: boolean, errors: string[]}}
     */
    static validate(value, schema) {
        const errors = [];

        if (!schema) {
            return {valid: true, errors};
        }

        // 类型检查
        if (schema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

            if (!expectedTypes.includes(actualType)) {
                errors.push(`类型错误: 期望 ${expectedTypes.join(' 或 ')}, 实际 ${actualType}`);
                return {valid: false, errors};
            }
        }

        // 字符串验证
        if (schema.type === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push(`字符串长度不能小于 ${schema.minLength}`);
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push(`字符串长度不能大于 ${schema.maxLength}`);
            }
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push(`字符串不匹配模式 ${schema.pattern}`);
            }
            if (schema.enum && !schema.enum.includes(value)) {
                errors.push(`值必须是以下之一: ${schema.enum.join(', ')}`);
            }
        }

        // 数字验证
        if (schema.type === 'number' || schema.type === 'integer') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push(`数值不能小于 ${schema.minimum}`);
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push(`数值不能大于 ${schema.maximum}`);
            }
            if (schema.type === 'integer' && !Number.isInteger(value)) {
                errors.push(`值必须是整数`);
            }
        }

        // 数组验证
        if (schema.type === 'array') {
            if (schema.minItems !== undefined && value.length < schema.minItems) {
                errors.push(`数组长度不能小于 ${schema.minItems}`);
            }
            if (schema.maxItems !== undefined && value.length > schema.maxItems) {
                errors.push(`数组长度不能大于 ${schema.maxItems}`);
            }
            if (schema.uniqueItems && new Set(value).size !== value.length) {
                errors.push(`数组元素必须唯一`);
            }
            if (schema.items) {
                for (let i = 0; i < value.length; i++) {
                    const itemResult = this.validate(value[i], schema.items);
                    if (!itemResult.valid) {
                        errors.push(`数组元素 [${i}]: ${itemResult.errors.join(', ')}`);
                    }
                }
            }
        }

        // 对象验证
        if (schema.type === 'object' && schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (value[key] !== undefined) {
                    const propResult = this.validate(value[key], propSchema);
                    if (!propResult.valid) {
                        errors.push(`属性 ${key}: ${propResult.errors.join(', ')}`);
                    }
                }
            }

            // 必需属性检查
            if (schema.required && Array.isArray(schema.required)) {
                for (const requiredKey of schema.required) {
                    if (value[requiredKey] === undefined) {
                        errors.push(`缺少必需属性: ${requiredKey}`);
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * 配置管理器
 */
export class ConfigurationManager extends Disposable {
    constructor() {
        super();
        this._configurations = new Map(); // extensionId -> configuration schema
        this._values = new Map();         // extensionId -> configuration values
        this._onDidChangeConfiguration = new Emitter();
        this._loadConfigurations();
    }

    /**
     * 配置变化事件
     */
    get onDidChangeConfiguration() {
        return this._onDidChangeConfiguration.event;
    }

    /**
     * 注册扩展配置
     * @param {string} extensionId
     * @param {Object} configurationSchema - 配置 Schema
     */
    registerConfiguration(extensionId, configurationSchema) {
        if (!configurationSchema || !configurationSchema.properties) {
            return;
        }

        this._configurations.set(extensionId, configurationSchema);

        // 初始化默认值
        const defaultValues = {};
        for (const [key, schema] of Object.entries(configurationSchema.properties)) {
            if (schema.default !== undefined) {
                defaultValues[key] = schema.default;
            }
        }

        // 合并已保存的值
        const savedValues = this._values.get(extensionId) || {};
        this._values.set(extensionId, {...defaultValues, ...savedValues});

        console.log(`✅ ConfigurationManager: 注册配置 ${extensionId}`);
    }

    /**
     * 获取配置值
     * @param {string} extensionId
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    get(extensionId, key, defaultValue) {
        const values = this._values.get(extensionId);
        if (!values) {
            return defaultValue;
        }

        const value = values[key];
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 获取所有配置
     * @param {string} extensionId
     * @returns {Object}
     */
    getAll(extensionId) {
        return {...(this._values.get(extensionId) || {})};
    }

    /**
     * 更新配置值
     * @param {string} extensionId
     * @param {string} key
     * @param {*} value
     * @param {string} scope - 配置作用域
     */
    async update(extensionId, key, value, scope = ConfigurationScope.APPLICATION) {
        const schema = this._configurations.get(extensionId);
        if (!schema || !schema.properties || !schema.properties[key]) {
            throw new Error(`配置项 ${key} 不存在`);
        }

        // 验证配置值
        const propSchema = schema.properties[key];
        const validation = ConfigurationValidator.validate(value, propSchema);

        if (!validation.valid) {
            throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
        }

        // 检查作用域
        const allowedScope = propSchema.scope || ConfigurationScope.APPLICATION;
        if (scope !== allowedScope) {
            console.warn(`⚠️ ConfigurationManager: 配置 ${key} 的作用域应为 ${allowedScope}`);
        }

        // 更新值
        const values = this._values.get(extensionId) || {};
        const oldValue = values[key];
        values[key] = value;
        this._values.set(extensionId, values);

        // 保存配置
        this._saveConfigurations();

        // 触发变化事件
        this._onDidChangeConfiguration.fire({
            extensionId,
            key,
            oldValue,
            newValue: value,
            scope
        });

        console.log(`✅ ConfigurationManager: 更新配置 ${extensionId}.${key} = ${JSON.stringify(value)}`);
    }

    /**
     * 批量更新配置
     * @param {string} extensionId
     * @param {Object} updates - { key: value }
     * @param {string} scope
     */
    async updateMultiple(extensionId, updates, scope = ConfigurationScope.APPLICATION) {
        const schema = this._configurations.get(extensionId);
        if (!schema || !schema.properties) {
            throw new Error(`扩展 ${extensionId} 没有注册配置`);
        }

        // 验证所有更新
        const validationErrors = [];
        for (const [key, value] of Object.entries(updates)) {
            const propSchema = schema.properties[key];
            if (!propSchema) {
                validationErrors.push(`配置项 ${key} 不存在`);
                continue;
            }

            const validation = ConfigurationValidator.validate(value, propSchema);
            if (!validation.valid) {
                validationErrors.push(`${key}: ${validation.errors.join(', ')}`);
            }
        }

        if (validationErrors.length > 0) {
            throw new Error(`配置验证失败:\n${validationErrors.join('\n')}`);
        }

        // 应用所有更新
        const values = this._values.get(extensionId) || {};
        const changes = [];

        for (const [key, value] of Object.entries(updates)) {
            const oldValue = values[key];
            values[key] = value;
            changes.push({key, oldValue, newValue: value});
        }

        this._values.set(extensionId, values);
        this._saveConfigurations();

        // 触发变化事件
        for (const change of changes) {
            this._onDidChangeConfiguration.fire({
                extensionId,
                key: change.key,
                oldValue: change.oldValue,
                newValue: change.newValue,
                scope
            });
        }

        console.log(`✅ ConfigurationManager: 批量更新配置 ${extensionId}`);
    }

    /**
     * 重置配置为默认值
     * @param {string} extensionId
     * @param {string} key - 如果不提供，重置所有配置
     */
    reset(extensionId, key = null) {
        const schema = this._configurations.get(extensionId);
        if (!schema || !schema.properties) {
            return;
        }

        const values = this._values.get(extensionId) || {};

        if (key) {
            // 重置单个配置
            const propSchema = schema.properties[key];
            if (propSchema) {
                const oldValue = values[key];
                const defaultValue = propSchema.default;
                values[key] = defaultValue;

                this._onDidChangeConfiguration.fire({
                    extensionId,
                    key,
                    oldValue,
                    newValue: defaultValue
                });
            }
        } else {
            // 重置所有配置
            for (const [k, propSchema] of Object.entries(schema.properties)) {
                const oldValue = values[k];
                const defaultValue = propSchema.default;
                values[k] = defaultValue;

                this._onDidChangeConfiguration.fire({
                    extensionId,
                    key: k,
                    oldValue,
                    newValue: defaultValue
                });
            }
        }

        this._values.set(extensionId, values);
        this._saveConfigurations();
    }

    /**
     * 加载配置
     */
    _loadConfigurations() {
        try {
            const stored = localStorage.getItem('extension-configurations');
            if (stored) {
                const data = JSON.parse(stored);
                for (const [extensionId, values] of Object.entries(data)) {
                    this._values.set(extensionId, values);
                }
            }
        } catch (error) {
            console.error('❌ ConfigurationManager: 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    _saveConfigurations() {
        try {
            const data = {};
            for (const [extensionId, values] of this._values) {
                data[extensionId] = values;
            }
            localStorage.setItem('extension-configurations', JSON.stringify(data));
        } catch (error) {
            console.error('❌ ConfigurationManager: 保存配置失败:', error);
        }
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();
        this._onDidChangeConfiguration.dispose();
        this._configurations.clear();
        this._values.clear();
    }
}
