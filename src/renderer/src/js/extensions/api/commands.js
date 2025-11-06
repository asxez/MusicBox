/**
 * Commands API - 命令 API
 * 提供命令注册、执行、管理等功能
 */

import {validate, Validator} from './common/validation.js';
import {ErrorUtils, NotFoundError} from './common/errors.js';
import {Disposable, toDisposable} from '../core/Lifecycle.js';

/**
 * 全局命令注册表
 */
const globalCommandRegistry = new Map();

/**
 * 创建命令 API
 * @param {Object} context - 扩展上下文
 * @returns {CommandsAPI} 命令 API 实例
 */
export function createCommandsAPI(context) {
    return {
        /**
         * 注册命令
         * @param {string} commandId - 命令 ID
         * @param {Function} callback - 回调函数
         * @param {Object} [options={}] - 命令选项
         * @returns {Disposable} 可释放对象
         */
        registerCommand(commandId, callback, options = {}) {
            validate.commandId(commandId);
            Validator.assertFunction(callback, 'callback');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                if (globalCommandRegistry.has(commandId)) {
                    console.warn(`⚠️ 命令 ${commandId} 已注册，将被覆盖`);
                }

                const commandInfo = {
                    id: commandId,
                    callback,
                    title: options.title || commandId,
                    category: options.category || '',
                    enabled: options.enabled !== false,
                    extensionId: context.extension?.id || 'unknown'
                };

                globalCommandRegistry.set(commandId, commandInfo);

                console.log(`✅ 命令已注册: ${commandId}`);

                return toDisposable(() => {
                    globalCommandRegistry.delete(commandId);
                    console.log(`🗑️ 命令已注销: ${commandId}`);
                });
            }, 'commands.registerCommand');
        },

        /**
         * 执行命令
         * @param {string} commandId - 命令 ID
         * @param {...any} args - 参数
         * @returns {Promise<*>} 命令执行结果
         */
        async executeCommand(commandId, ...args) {
            validate.commandId(commandId);

            return ErrorUtils.wrapAsync(async () => {
                const commandInfo = globalCommandRegistry.get(commandId);

                if (!commandInfo) {
                    throw new NotFoundError('命令', commandId);
                }

                if (!commandInfo.enabled) {
                    throw new Error(`命令 ${commandId} 已禁用`);
                }

                console.log(`🎯 执行命令: ${commandId}`, args);

                try {
                    const result = await commandInfo.callback(...args);
                    console.log(`✅ 命令执行成功: ${commandId}`);
                    return result;
                } catch (error) {
                    console.error(`❌ 命令执行失败: ${commandId}`, error);
                    throw error;
                }
            }, 'commands.executeCommand');
        },

        /**
         * 获取所有已注册的命令
         * @returns {Array<Object>} 命令列表
         */
        getCommands() {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalCommandRegistry.values()).map(cmd => ({
                    id: cmd.id,
                    title: cmd.title,
                    category: cmd.category,
                    enabled: cmd.enabled,
                    extensionId: cmd.extensionId
                }));
            }, 'commands.getCommands');
        },

        /**
         * 检查命令是否存在
         * @param {string} commandId - 命令 ID
         * @returns {boolean} 是否存在
         */
        hasCommand(commandId) {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                return globalCommandRegistry.has(commandId);
            }, 'commands.hasCommand');
        },

        /**
         * 启用命令
         * @param {string} commandId - 命令 ID
         * @returns {void}
         */
        enableCommand(commandId) {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                const commandInfo = globalCommandRegistry.get(commandId);
                if (commandInfo) {
                    commandInfo.enabled = true;
                    console.log(`✅ 命令已启用: ${commandId}`);
                }
            }, 'commands.enableCommand');
        },

        /**
         * 禁用命令
         * @param {string} commandId - 命令 ID
         * @returns {void}
         */
        disableCommand(commandId) {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                const commandInfo = globalCommandRegistry.get(commandId);
                if (commandInfo) {
                    commandInfo.enabled = false;
                    console.log(`⛔ 命令已禁用: ${commandId}`);
                }
            }, 'commands.disableCommand');
        },

        /**
         * 获取命令信息
         * @param {string} commandId - 命令 ID
         * @returns {Object|null} 命令信息
         */
        getCommandInfo(commandId) {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                const commandInfo = globalCommandRegistry.get(commandId);
                if (commandInfo) {
                    return {
                        id: commandInfo.id,
                        title: commandInfo.title,
                        category: commandInfo.category,
                        enabled: commandInfo.enabled,
                        extensionId: commandInfo.extensionId
                    };
                }
                return null;
            }, 'commands.getCommandInfo');
        }
    };
}

export {globalCommandRegistry};
