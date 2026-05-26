/**
 * IPC 处理器装饰器
 * 简化 IPC 通道的注册和管理
 */

import {ipcMain, IpcMainInvokeEvent} from 'electron';

/**
 * 控制器元数据
 */
interface ControllerMetadata {
    name: string;
    handlers: Map<string, HandlerMetadata>;
}

/**
 * 处理器元数据
 */
interface HandlerMetadata {
    channel: string;
    methodName: string;
    type: 'handle' | 'on';
}

// 存储控制器元数据
const controllerMetadataMap = new Map<Function, ControllerMetadata>();

/**
 * 控制器装饰器
 * @param name - 控制器名称（用于 IPC 通道前缀）
 */
export function Controller(name: string): ClassDecorator {
    return function (target: Function) {
        const existing = controllerMetadataMap.get(target);
        if (existing) {
            // Method decorators already ran — only update the name
            existing.name = name;
        } else {
            controllerMetadataMap.set(target, {name, handlers: new Map()});
        }
    };
}

/**
 * IPC Handle 装饰器（用于 ipcMain.handle）
 * @param channel - IPC 通道名称
 */
export function IpcHandle(channel: string): MethodDecorator {
    return function (
        target: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor
    ) {
        const constructor = target.constructor;
        let metadata = controllerMetadataMap.get(constructor);

        if (!metadata) {
            metadata = {
                name: '',
                handlers: new Map()
            };
            controllerMetadataMap.set(constructor, metadata);
        }

        metadata.handlers.set(propertyKey.toString(), {
            channel,
            methodName: propertyKey.toString(),
            type: 'handle'
        });
    };
}

/**
 * IPC On 装饰器（用于 ipcMain.on）
 * @param channel - IPC 通道名称
 */
export function IpcOn(channel: string): MethodDecorator {
    return function (
        target: any,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor
    ) {
        const constructor = target.constructor;
        let metadata = controllerMetadataMap.get(constructor);

        if (!metadata) {
            metadata = {
                name: '',
                handlers: new Map()
            };
            controllerMetadataMap.set(constructor, metadata);
        }

        metadata.handlers.set(propertyKey.toString(), {
            channel,
            methodName: propertyKey.toString(),
            type: 'on'
        });
    };
}

/**
 * 基础控制器类
 */
export abstract class BaseController {
    /**
     * 注册控制器的所有 IPC 处理器
     */
    register(): void {
        const constructor = this.constructor;
        const metadata = controllerMetadataMap.get(constructor);

        if (!metadata) {
            console.warn(`⚠️ 控制器 ${constructor.name} 没有元数据`);
            return;
        }

        let registeredCount = 0;

        for (const [methodName, handler] of metadata.handlers) {
            const method = (this as any)[methodName];

            if (typeof method !== 'function') {
                console.error(`❌ 方法 ${methodName} 不存在于控制器 ${constructor.name}`);
                continue;
            }

            if (handler.type === 'handle') {
                ipcMain.handle(handler.channel, (_event: IpcMainInvokeEvent, ...args: any[]) => {
                    try {
                        const result = method.apply(this, args);
                        if (result && typeof result.then === 'function') {
                            return result.catch((error: unknown) => {
                                console.error(`❌ IPC 处理器错误 [${handler.channel}]:`, error);
                                throw error;
                            });
                        }
                        return result;
                    } catch (error) {
                        console.error(`❌ IPC 处理器错误 [${handler.channel}]:`, error);
                        throw error;
                    }
                });
                registeredCount++;
            } else if (handler.type === 'on') {
                ipcMain.on(handler.channel, (_event, ...args: any[]) => {
                    try {
                        method.apply(this, args);
                    } catch (error) {
                        console.error(`❌ IPC 监听器错误 [${handler.channel}]:`, error);
                    }
                });
                registeredCount++;
            }
        }

        console.log(`✅ 控制器 ${constructor.name} 注册了 ${registeredCount} 个 IPC 处理器`);
    }

    /**
     * 注销控制器的所有 IPC 处理器
     */
    unregister(): void {
        const constructor = this.constructor;
        const metadata = controllerMetadataMap.get(constructor);

        if (!metadata) {
            return;
        }

        for (const [, handler] of metadata.handlers) {
            if (handler.type === 'handle') {
                ipcMain.removeHandler(handler.channel);
            } else if (handler.type === 'on') {
                ipcMain.removeAllListeners(handler.channel);
            }
        }

        console.log(`🗑️ 控制器 ${constructor.name} 已注销`);
    }
}

/**
 * 获取控制器元数据
 */
export function getControllerMetadata(target: Function): ControllerMetadata | undefined {
    return controllerMetadataMap.get(target);
}
