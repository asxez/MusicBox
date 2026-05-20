/**
 * ExtensionDependencies - 扩展依赖管理
 * 处理扩展间的依赖关系、版本兼容性和加载顺序
 */

import {ExtensionDescriptor} from '@extensions/core/ExtensionsRegistry';

interface VersionParts {
    major: number;
    minor: number;
    patch: number;
}

/**
 * 版本比较工具
 */
export class VersionComparator {
    /**
     * 解析版本号
     * @param version - 版本号字符串,如 "1.2.3"
     * @returns 版本号对象
     */
    static parse(version: string): VersionParts {
        if (!version) {
            return {major: 0, minor: 0, patch: 0};
        }

        const parts = version.replace(/^[^0-9]+/, '').split('.');
        return {
            major: parseInt(parts[0]) || 0,
            minor: parseInt(parts[1]) || 0,
            patch: parseInt(parts[2]) || 0
        };
    }

    /**
     * 比较两个版本
     * @param v1 - 版本1
     * @param v2 - 版本2
     * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
     */
    static compare(v1: string, v2: string): number {
        const ver1 = this.parse(v1);
        const ver2 = this.parse(v2);

        if (ver1.major !== ver2.major) {
            return ver1.major > ver2.major ? 1 : -1;
        }
        if (ver1.minor !== ver2.minor) {
            return ver1.minor > ver2.minor ? 1 : -1;
        }
        if (ver1.patch !== ver2.patch) {
            return ver1.patch > ver2.patch ? 1 : -1;
        }
        return 0;
    }

    /**
     * 检查版本是否满足要求
     * @param version - 实际版本
     * @param requirement - 版本要求,如 "^1.0.0", ">=1.2.0", "~1.2.3"
     * @returns 是否满足要求
     */
    static satisfies(version: string, requirement: string): boolean {
        if (!requirement) {
            return true;
        }

        // 处理 ^ 符号（兼容版本）
        if (requirement.startsWith('^')) {
            const reqVer = this.parse(requirement.substring(1));
            const actVer = this.parse(version);

            // 主版本必须相同,次版本和补丁版本可以更高
            return actVer.major === reqVer.major &&
                (actVer.minor > reqVer.minor ||
                    (actVer.minor === reqVer.minor && actVer.patch >= reqVer.patch));
        }

        // 处理 ~ 符号（近似版本）
        if (requirement.startsWith('~')) {
            const reqVer = this.parse(requirement.substring(1));
            const actVer = this.parse(version);

            // 主版本和次版本必须相同,补丁版本可以更高
            return actVer.major === reqVer.major &&
                actVer.minor === reqVer.minor &&
                actVer.patch >= reqVer.patch;
        }

        // 处理 >= 符号
        if (requirement.startsWith('>=')) {
            return this.compare(version, requirement.substring(2)) >= 0;
        }

        // 处理 > 符号
        if (requirement.startsWith('>')) {
            return this.compare(version, requirement.substring(1)) > 0;
        }

        // 处理 <= 符号
        if (requirement.startsWith('<=')) {
            return this.compare(version, requirement.substring(2)) <= 0;
        }

        // 处理 < 符号
        if (requirement.startsWith('<')) {
            return this.compare(version, requirement.substring(1)) < 0;
        }

        // 处理 = 符号或精确匹配
        const exactVersion = requirement.startsWith('=') ? requirement.substring(1) : requirement;
        return this.compare(version, exactVersion) === 0;
    }
}

/**
 * 依赖图节点
 */
class DependencyNode {
    readonly extensionId: string;
    readonly dependencies: Set<string> = new Set();
    readonly dependents: Set<string> = new Set();
    visited = false;
    inStack = false;

    constructor(extensionId: string) {
        this.extensionId = extensionId;
    }

    addDependency(extensionId: string): void {
        this.dependencies.add(extensionId);
    }

    addDependent(extensionId: string): void {
        this.dependents.add(extensionId);
    }
}

export interface DependencyCheckResult {
    satisfied: boolean;
    missing: string[];
    incompatible: Array<{
        id: string;
        required: string;
        actual: string;
    }>;
}

interface ExtensionsRegistry {
    getAllExtensions(): ExtensionDescriptor[];

    getExtension(id: string): ExtensionDescriptor | undefined;
}

/**
 * 依赖解析器
 */
export class DependencyResolver {
    private readonly registry: ExtensionsRegistry;
    private _dependencyGraph = new Map<string, DependencyNode>();

    constructor(registry: ExtensionsRegistry) {
        this.registry = registry;
    }

    /**
     * 构建依赖图
     */
    buildDependencyGraph(): void {
        this._dependencyGraph.clear();

        const allExtensions = this.registry.getAllExtensions();

        // 创建所有节点
        for (const ext of allExtensions) {
            if (!this._dependencyGraph.has(ext.id)) {
                this._dependencyGraph.set(ext.id, new DependencyNode(ext.id));
            }
        }

        // 建立依赖关系
        for (const ext of allExtensions) {
            const node = this._dependencyGraph.get(ext.id);
            const dependencies = this._getExtensionDependencies(ext);

            for (const depId of dependencies) {
                node!.addDependency(depId);

                // 确保依赖节点存在
                if (!this._dependencyGraph.has(depId)) {
                    this._dependencyGraph.set(depId, new DependencyNode(depId));
                }

                const depNode = this._dependencyGraph.get(depId);
                depNode!.addDependent(ext.id);
            }
        }
    }

    /**
     * 获取扩展的依赖列表
     */
    private _getExtensionDependencies(extension: ExtensionDescriptor): string[] {
        const dependencies: string[] = [];

        // 从 manifest 中提取依赖
        if (extension.extensionDependencies && Array.isArray(extension.extensionDependencies)) {
            for (const dep of extension.extensionDependencies) {
                // 依赖格式: "extension-id@^1.0.0" 或 "extension-id"
                const depId = dep.split('@')[0];
                dependencies.push(depId);
            }
        }

        return dependencies;
    }

    /**
     * 检查依赖是否满足
     * @param extensionId - 扩展ID
     * @returns 依赖检查结果
     */
    checkDependencies(extensionId: string): DependencyCheckResult {
        const extension = this.registry.getExtension(extensionId);
        if (!extension) {
            return {satisfied: false, missing: [extensionId], incompatible: []};
        }

        const missing: string[] = [];
        const incompatible: Array<{ id: string; required: string; actual: string }> = [];

        if (extension.extensionDependencies && Array.isArray(extension.extensionDependencies)) {
            for (const dep of extension.extensionDependencies) {
                const [depId, versionReq] = dep.split('@');
                const depExtension = this.registry.getExtension(depId);

                if (!depExtension) {
                    missing.push(depId);
                    continue;
                }

                if (versionReq && !VersionComparator.satisfies(depExtension.version, versionReq)) {
                    incompatible.push({
                        id: depId,
                        required: versionReq,
                        actual: depExtension.version
                    });
                }
            }
        }

        return {
            satisfied: missing.length === 0 && incompatible.length === 0,
            missing,
            incompatible
        };
    }

    /**
     * 检测循环依赖
     * @returns 循环依赖链数组
     */
    detectCircularDependencies(): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const stack: string[] = [];

        const dfs = (nodeId: string): void => {
            const node = this._dependencyGraph.get(nodeId);
            if (!node) return;

            if (stack.includes(nodeId)) {
                // 发现循环
                const cycleStart = stack.indexOf(nodeId);
                cycles.push([...stack.slice(cycleStart), nodeId]);
                return;
            }

            if (visited.has(nodeId)) {
                return;
            }

            visited.add(nodeId);
            stack.push(nodeId);

            for (const depId of node.dependencies) {
                dfs(depId);
            }

            stack.pop();
        };

        for (const nodeId of this._dependencyGraph.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }

        return cycles;
    }

    /**
     * 拓扑排序 - 确定扩展加载顺序
     * @param extensionIds - 要排序的扩展ID列表
     * @returns 排序后的扩展ID列表
     */
    topologicalSort(extensionIds: string[]): string[] {
        const result: string[] = [];
        const visited = new Set<string>();
        const temp = new Set<string>();

        const visit = (nodeId: string): void => {
            if (visited.has(nodeId)) {
                return;
            }

            if (temp.has(nodeId)) {
                throw new Error(`检测到循环依赖: ${nodeId}`);
            }

            temp.add(nodeId);

            const node = this._dependencyGraph.get(nodeId);
            if (node) {
                for (const depId of node.dependencies) {
                    // 只处理在 extensionIds 中的依赖
                    if (extensionIds.includes(depId)) {
                        visit(depId);
                    }
                }
            }

            temp.delete(nodeId);
            visited.add(nodeId);
            result.push(nodeId);
        };

        for (const id of extensionIds) {
            if (!visited.has(id)) {
                visit(id);
            }
        }

        return result;
    }

    /**
     * 获取扩展的所有依赖（递归）
     * @param extensionId - 扩展ID
     * @returns 依赖ID列表
     */
    getAllDependencies(extensionId: string): string[] {
        const dependencies = new Set<string>();
        const visited = new Set<string>();

        const collect = (id: string): void => {
            if (visited.has(id)) {
                return;
            }
            visited.add(id);

            const node = this._dependencyGraph.get(id);
            if (node) {
                for (const depId of node.dependencies) {
                    dependencies.add(depId);
                    collect(depId);
                }
            }
        };

        collect(extensionId);
        return Array.from(dependencies);
    }

    /**
     * 获取依赖此扩展的所有扩展（递归）
     * @param extensionId - 扩展ID
     * @returns 依赖者ID列表
     */
    getAllDependents(extensionId: string): string[] {
        const dependents = new Set<string>();
        const visited = new Set<string>();

        const collect = (id: string): void => {
            if (visited.has(id)) {
                return;
            }
            visited.add(id);

            const node = this._dependencyGraph.get(id);
            if (node) {
                for (const depId of node.dependents) {
                    dependents.add(depId);
                    collect(depId);
                }
            }
        };

        collect(extensionId);
        return Array.from(dependents);
    }
}
