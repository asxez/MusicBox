/**
 * 依赖注入容器
 * 管理服务的注册、实例化和生命周期
 */

export type ServiceFactory<T = any> = () => T | Promise<T>;

/**
 * 服务容器类
 */
export class ServiceContainer {
    private services = new Map<string, any>();
    private factories = new Map<string, ServiceFactory>();
    private singletons = new Set<string>();

    /**
     * 注册服务工厂
     * @param name - 服务名称
     * @param factory - 服务工厂函数
     * @param singleton - 是否为单例（默认 true）
     */
    register<T>(name: string, factory: ServiceFactory<T>, singleton: boolean = true): void {
        if (this.factories.has(name)) {
            console.warn(`⚠️ 服务 ${name} 已存在，将被覆盖`);
        }

        this.factories.set(name, factory);
        if (singleton) {
            this.singletons.add(name);
        }
    }

    /**
     * 获取服务实例
     * @param name - 服务名称
     * @returns 服务实例
     */
    async get<T>(name: string): Promise<T> {
        // 如果是单例且已实例化，直接返回
        if (this.singletons.has(name) && this.services.has(name)) {
            return this.services.get(name);
        }

        // 获取工厂函数
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`❌ 服务未注册: ${name}`);
        }

        // 创建实例
        try {
            const instance = await factory();

            // 如果是单例，缓存实例
            if (this.singletons.has(name)) {
                this.services.set(name, instance);
            }

            return instance;
        } catch (error) {
            throw new Error(`❌ 创建服务失败 ${name}: ${(error as Error).message}`);
        }
    }

    /**
     * 同步获取服务实例（仅用于已实例化的单例）
     * @param name - 服务名称
     * @returns 服务实例
     */
    getSync<T>(name: string): T {
        if (!this.services.has(name)) {
            throw new Error(`❌ 服务未实例化: ${name}`);
        }
        return this.services.get(name);
    }

    /**
     * 检查服务是否已注册
     * @param name - 服务名称
     * @returns 是否已注册
     */
    has(name: string): boolean {
        return this.factories.has(name);
    }

    /**
     * 检查服务是否已实例化
     * @param name - 服务名称
     * @returns 是否已实例化
     */
    isInstantiated(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * 移除服务
     * @param name - 服务名称
     */
    remove(name: string): void {
        this.factories.delete(name);
        this.services.delete(name);
        this.singletons.delete(name);
    }

    /**
     * 清空所有服务
     */
    clear(): void {
        this.factories.clear();
        this.services.clear();
        this.singletons.clear();
    }

    /**
     * 获取所有已注册的服务名称
     */
    getRegisteredServices(): string[] {
        return Array.from(this.factories.keys());
    }

    /**
     * 获取所有已实例化的服务名称
     */
    getInstantiatedServices(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * 获取容器统计信息
     */
    getStats(): {
        registered: number;
        instantiated: number;
        singletons: number;
    } {
        return {
            registered: this.factories.size,
            instantiated: this.services.size,
            singletons: this.singletons.size
        };
    }
}
