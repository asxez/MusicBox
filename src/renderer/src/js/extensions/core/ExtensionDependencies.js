/**
 * ExtensionDependencies - 扩展依赖管理
 * 处理扩展间的依赖关系、版本兼容性和加载顺序
 */

/**
 * 版本比较工具
 */
export class VersionComparator {
    /**
     * 解析版本号
     * @param {string} version - 版本号字符串，如 "1.2.3"
     * @returns {{major: number, minor: number, patch: number}}
     */
    static parse(version) {
        if (!version || typeof version !== 'string') {
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
     * @param {string} v1
     * @param {string} v2
     * @returns {number} -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
     */
    static compare(v1, v2) {
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
     * @param {string} version - 实际版本
     * @param {string} requirement - 版本要求，如 "^1.0.0", ">=1.2.0", "~1.2.3"
     * @returns {boolean}
     */
    static satisfies(version, requirement) {
        if (!requirement) {
            return true;
        }

        // 处理 ^ 符号（兼容版本）
        if (requirement.startsWith('^')) {
            const reqVer = this.parse(requirement.substring(1));
            const actVer = this.parse(version);

            // 主版本必须相同，次版本和补丁版本可以更高
            return actVer.major === reqVer.major &&
                (actVer.minor > reqVer.minor ||
                    (actVer.minor === reqVer.minor && actVer.patch >= reqVer.patch));
        }

        // 处理 ~ 符号（近似版本）
        if (requirement.startsWith('~')) {
            const reqVer = this.parse(requirement.substring(1));
            const actVer = this.parse(version);

            // 主版本和次版本必须相同，补丁版本可以更高
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
    constructor(extensionId) {
        this.extensionId = extensionId;
        this.dependencies = new Set();  // 依赖的扩展
        this.dependents = new Set();    // 依赖此扩展的扩展
        this.visited = false;
        this.inStack = false;
    }

    addDependency(extensionId) {
        this.dependencies.add(extensionId);
    }

    addDependent(extensionId) {
        this.dependents.add(extensionId);
    }
}

/**
 * 依赖解析器
 */
export class DependencyResolver {
    constructor(registry) {
        this.registry = registry;
        this._dependencyGraph = new Map();
    }

    /**
     * 构建依赖图
     */
    buildDependencyGraph() {
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
                node.addDependency(depId);

                // 确保依赖节点存在
                if (!this._dependencyGraph.has(depId)) {
                    this._dependencyGraph.set(depId, new DependencyNode(depId));
                }

                const depNode = this._dependencyGraph.get(depId);
                depNode.addDependent(ext.id);
            }
        }
    }

    /**
     * 获取扩展的依赖列表
     */
    _getExtensionDependencies(extension) {
        const dependencies = [];

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
     * @param {string} extensionId
     * @returns {{satisfied: boolean, missing: string[], incompatible: Array}}
     */
    checkDependencies(extensionId) {
        const extension = this.registry.getExtension(extensionId);
        if (!extension) {
            return {satisfied: false, missing: [extensionId], incompatible: []};
        }

        const missing = [];
        const incompatible = [];

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
     * @returns {Array<string[]>} 循环依赖链数组
     */
    detectCircularDependencies() {
        const cycles = [];
        const visited = new Set();
        const stack = [];

        const dfs = (nodeId) => {
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
     * @param {string[]} extensionIds - 要排序的扩展ID列表
     * @returns {string[]} 排序后的扩展ID列表
     */
    topologicalSort(extensionIds) {
        const result = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (nodeId) => {
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
     * @param {string} extensionId
     * @returns {string[]}
     */
    getAllDependencies(extensionId) {
        const dependencies = new Set();
        const visited = new Set();

        const collect = (id) => {
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
     * @param {string} extensionId
     * @returns {string[]}
     */
    getAllDependents(extensionId) {
        const dependents = new Set();
        const visited = new Set();

        const collect = (id) => {
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
