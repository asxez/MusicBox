/**
 * Commands API - 命令 API
 * 提供命令注册、执行、管理等功能
 */

import {validate, Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotFoundError} from '@extensions/api/common/errors';
import {IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import {ExtensionContext} from "@extensions/core/ExtensionActivator";
import {CommandInfo, CommandOptions, CommandsAPI, PublicCommandInfo} from "@extensions/api/types/commands";

/**
 * 全局命令注册表
 */
const globalCommandRegistry = new Map<string, CommandInfo>();

/**
 * 创建命令 API
 * @param context - 扩展上下文
 * @returns 命令 API 实例
 */
export function createCommandsAPI(context: ExtensionContext): CommandsAPI {
    return {
        registerCommand(
            commandId: string,
            callback: (...args: any[]) => any,
            options: CommandOptions = {}
        ): IDisposable {
            validate.commandId(commandId);
            Validator.assertFunction(callback, 'callback');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                if (globalCommandRegistry.has(commandId)) {
                    console.warn(`⚠️ 命令 ${commandId} 已注册，将被覆盖`);
                }

                const commandInfo: CommandInfo = {
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

        async executeCommand(commandId: string, ...args: any[]): Promise<any> {
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

        getCommands(): PublicCommandInfo[] {
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

        hasCommand(commandId: string): boolean {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                return globalCommandRegistry.has(commandId);
            }, 'commands.hasCommand');
        },

        enableCommand(commandId: string): void {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                const commandInfo = globalCommandRegistry.get(commandId);
                if (commandInfo) {
                    commandInfo.enabled = true;
                    console.log(`✅ 命令已启用: ${commandId}`);
                }
            }, 'commands.enableCommand');
        },

        disableCommand(commandId: string): void {
            validate.commandId(commandId);

            return ErrorUtils.wrapSync(() => {
                const commandInfo = globalCommandRegistry.get(commandId);
                if (commandInfo) {
                    commandInfo.enabled = false;
                    console.log(`⛔ 命令已禁用: ${commandId}`);
                }
            }, 'commands.disableCommand');
        },

        getCommandInfo(commandId: string): PublicCommandInfo | null {
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
