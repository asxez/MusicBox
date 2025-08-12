/**
 * 插件加载器 - 负责动态加载和管理插件文件
 * 支持多种插件格式和热重载功能
 */

class PluginLoader extends EventEmitter {
    constructor() {
        super();
        this.loadedScripts = new Map(); // 已加载的脚本
        this.pluginModules = new Map(); // 插件模块缓存
        this.watchedFiles = new Map(); // 监听的文件
        this.isHotReloadEnabled = false;
    }

    // 启用热重载
    enableHotReload() {
        this.isHotReloadEnabled = true;
    }

    // 禁用热重载
    disableHotReload() {
        this.isHotReloadEnabled = false;
        // 清理文件监听
        this.watchedFiles.clear();
    }

    // 加载插件脚本
    async loadPluginScript(config) {
        const pluginId = config.id;
        const scriptPath = config.main || `plugins/${pluginId}/index.js`;
        
        try {
            console.log(`🔌 PluginLoader: 开始加载插件脚本 ${scriptPath}`);
            
            // 检查是否已加载
            if (this.loadedScripts.has(pluginId)) {
                console.log(`🔌 PluginLoader: 插件 ${pluginId} 脚本已加载，使用缓存`);
                return this.pluginModules.get(pluginId);
            }
            
            // 动态加载脚本
            const module = await this.dynamicImport(scriptPath, pluginId);
            
            // 缓存模块
            this.pluginModules.set(pluginId, module);
            this.loadedScripts.set(pluginId, scriptPath);
            
            // 设置热重载监听
            if (this.isHotReloadEnabled) {
                this.watchFile(pluginId, scriptPath);
            }
            
            console.log(`✅ PluginLoader: 插件脚本 ${scriptPath} 加载成功`);
            return module;
        } catch (error) {
            console.error(`❌ PluginLoader: 加载插件脚本失败 ${scriptPath}:`, error);
            throw error;
        }
    }

    // 动态导入脚本
    async dynamicImport(scriptPath, pluginId) {
        return new Promise((resolve, reject) => {
            try {
                let pluginCode = '';

                // 检查是否是base64编码的data URL
                if (scriptPath.startsWith('data:text/javascript;base64,')) {
                    // 解码验证base64内容
                    const base64Code = scriptPath.replace('data:text/javascript;base64,', '');
                    const base64Validation = this.validateBase64Format(base64Code);
                    console.log(`🔍 PluginLoader: Base64格式验证:`, base64Validation);

                    try {
                        // 尝试 UTF-8 安全解码
                        pluginCode = this.decodeBase64ToUTF8(base64Code);
                        console.log(`🔍 PluginLoader: Base64解码成功 ${pluginId}`);
                        console.log(`🔍 PluginLoader: 解码后长度: ${pluginCode.length} 字符`);

                        // 检查解码后内容的类型和格式
                        const decodedAnalysis = this.analyzeDecodedContent(pluginCode, pluginId);
                        console.log(`🔍 PluginLoader: 解码内容分析:`, decodedAnalysis);

                        // 如果检测到数字数组格式，尝试修复
                        if (decodedAnalysis.isNumericArray) {
                            console.warn(`⚠️ PluginLoader: 检测到数字数组格式，尝试修复...`);
                            pluginCode = this.fixNumericArrayContent(pluginCode, pluginId);
                            console.log(`🔧 PluginLoader: 修复后代码长度: ${pluginCode.length} 字符`);
                        }

                        // 验证和修复解码后的代码
                        const codeValidation = this.validatePluginCode(pluginCode, pluginId);
                        console.log(`🔍 PluginLoader: 解码代码验证:`, codeValidation);

                        if (!codeValidation.isValid) {
                            console.warn(`⚠️ PluginLoader: 解码后的代码验证失败 ${pluginId}:`, codeValidation.issues);

                            // 尝试修复常见问题
                            pluginCode = this.fixCommonCodeIssues(pluginCode, pluginId);
                            console.log(`🔧 PluginLoader: 尝试修复代码问题后的长度: ${pluginCode.length}`);
                        }

                        // 显示解码后代码的关键部分
                        this.logCodePreview(pluginCode, pluginId);

                    } catch (decodeError) {
                        console.error(`❌ PluginLoader: Base64解码失败:`, decodeError);
                        console.log(`❌ PluginLoader: 解码错误详情:`, {
                            errorMessage: decodeError.message,
                            base64Length: base64Code.length,
                            base64Sample: base64Code.substring(0, 200)
                        });
                        throw new Error(`Base64解码失败: ${decodeError.message}`);
                    }

                    console.log(`🔍 PluginLoader: ===== Base64解码调试完成 ${pluginId} =====`);
                } else {
                    // 对于普通文件路径，需要同步处理
                    console.log(`🔌 PluginLoader: 加载外部插件文件 ${scriptPath}`);
                    this.loadExternalScript(scriptPath, pluginId, resolve, reject);
                    return;
                }

                // 执行插件代码并获取插件类
                this.executePluginCode(pluginCode, pluginId, resolve, reject);

            } catch (error) {
                console.error(`❌ PluginLoader: 动态导入失败 ${pluginId}:`, error);
                reject(error);
            }
        });
    }

    // 执行插件代码
    executePluginCode(code, pluginId, resolve, reject) {
        try {
            // 验证代码内容
            if (!code || code.trim().length === 0) {
                throw new Error('插件代码为空或解码失败');
            }

            // 检查代码中的关键元素
            const codeAnalysis = {
                hasClass: code.includes('class '),
                hasPluginBase: code.includes('PluginBase'),
                hasExtends: code.includes('extends'),
                hasWindowPluginClass: code.includes('window.PluginClass'),
                hasExportStatement: code.includes('window.PluginClass') || code.includes('module.exports') || code.includes('export')
            };
            console.log(`🔍 PluginLoader: 代码分析:`, codeAnalysis);

            // 检查PluginBase是否可用
            if (!window.PluginBase) {
                throw new Error('PluginBase 类不可用，插件系统可能未正确初始化');
            }

            // 清理之前的插件类导出
            const previousExports = this.clearPreviousPluginExports();
            console.log(`🔍 PluginLoader: 清理之前的插件导出:`, previousExports);

            // 在执行前检查全局环境
            const globalsBefore = Object.keys(window).filter(k => k.includes('Plugin') || k.includes('Theme'));
            console.log(`🔍 PluginLoader: 执行前相关全局变量:`, globalsBefore);

            // 执行插件代码
            console.log(`🔍 PluginLoader: 开始执行插件代码...`);

            try {
                // 使用Function构造函数创建一个新的函数作用域，但仍然可以访问全局变量
                const executeFunction = new Function('window', 'PluginBase', 'EventEmitter', code);
                executeFunction(window, window.PluginBase, window.EventEmitter);
                console.log(`🔍 PluginLoader: 代码执行完成，无异常`);

            } catch (execError) {
                console.error(`❌ PluginLoader: 代码执行异常:`, execError);
                console.log(`❌ PluginLoader: 异常堆栈:`, execError.stack);

                // 尝试使用eval作为备用方案
                console.log(`🔍 PluginLoader: 尝试使用eval作为备用执行方案...`);
                try {
                    eval(code);
                    console.log(`🔍 PluginLoader: eval执行成功`);
                } catch (evalError) {
                    console.error(`❌ PluginLoader: eval执行也失败:`, evalError);
                    throw new Error(`插件代码执行失败: ${execError.message}`);
                }
            }

            // 等待一小段时间确保代码完全执行
            setTimeout(() => {
                this.validateAndResolvePlugin(pluginId, resolve, reject);
            }, 10);

        } catch (error) {
            console.error(`❌ PluginLoader: 执行插件代码失败 ${pluginId}:`, error);
            console.log(`❌ PluginLoader: 错误堆栈:`, error.stack);
            reject(error);
        }
    }

    // 清理之前的插件导出
    clearPreviousPluginExports() {
        const previousExports = {};

        // 清理常见的插件导出变量
        const exportNames = ['PluginClass', 'Plugin', 'default'];
        exportNames.forEach(name => {
            if (window[name]) {
                previousExports[name] = typeof window[name];
                delete window[name];
            }
        });

        // 清理可能的插件特定导出
        Object.keys(window).forEach(key => {
            if (key.startsWith('Plugin_') || key.endsWith('Plugin')) {
                if (typeof window[key] === 'function') {
                    previousExports[key] = 'function';
                    delete window[key];
                }
            }
        });

        return previousExports;
    }

    // 验证并解析插件类
    validateAndResolvePlugin(pluginId, resolve, reject) {
        try {
            console.log(`🔍 PluginLoader: 开始验证插件类 ${pluginId}`);

            // 检查执行后的全局环境
            const globalsAfter = Object.keys(window).filter(k => k.includes('Plugin') || k.includes('Theme'));
            console.log(`🔍 PluginLoader: 执行后相关全局变量:`, globalsAfter);

            // 尝试多种方式获取插件类
            let PluginClass = this.findPluginClass(pluginId);

            console.log(`🔍 PluginLoader: 插件类检查详情:`, {
                exists: !!PluginClass,
                type: typeof PluginClass,
                isFunction: typeof PluginClass === 'function',
                name: PluginClass ? PluginClass.name : 'N/A',
                hasPrototype: PluginClass ? !!PluginClass.prototype : false
            });

            if (PluginClass && typeof PluginClass === 'function') {
                // 验证插件类
                const validationResult = this.validatePluginClass(PluginClass, pluginId);

                // 创建标准的模块导出格式
                const moduleExport = {
                    default: PluginClass,
                    // 提供额外的导出方式以确保兼容性
                    PluginClass: PluginClass,
                    [PluginClass.name]: PluginClass
                };

                if (validationResult.isValid) {
                    console.log(`✅ PluginLoader: 插件类验证成功 ${pluginId}`);
                    resolve(moduleExport);
                } else {
                    console.warn(`⚠️ PluginLoader: 插件类验证有警告 ${pluginId}:`, validationResult.warnings);

                    // 检查是否有严重错误
                    const hasCriticalError = validationResult.warnings.some(warning =>
                        warning.includes('不是一个有效的构造函数') ||
                        warning.includes('缺少prototype属性')
                    );

                    if (hasCriticalError) {
                        const error = new Error(`插件类验证失败: ${validationResult.warnings.join(', ')}`);
                        console.error(`❌ PluginLoader: ${error.message}`);
                        reject(error);
                    } else {
                        // 只有警告，仍然返回插件类
                        resolve(moduleExport);
                    }
                }
            } else {
                const error = new Error(`插件类未找到或不是构造函数: ${pluginId} (type: ${typeof PluginClass})`);
                console.error(`❌ PluginLoader: ${error.message}`);

                // 提供详细的调试信息
                this.logPluginClassDebugInfo(pluginId);

                reject(error);
            }

            console.log(`🔍 PluginLoader: ===== 插件代码执行完成 ${pluginId} =====`);

        } catch (error) {
            console.error(`❌ PluginLoader: 验证插件类失败 ${pluginId}:`, error);
            reject(error);
        }
    }

    // 查找插件类
    findPluginClass(pluginId) {
        console.log(`🔍 PluginLoader: 开始查找插件类，pluginId: ${pluginId}`);

        // 按优先级尝试不同的导出方式
        const candidates = [
            'PluginClass',                    // 标准导出
            'Plugin',                         // 简化导出
            `Plugin_${pluginId}`,            // 插件特定导出
            'default'                         // 默认导出
        ];

        // 第一步：检查标准候选项
        for (const candidate of candidates) {
            if (window[candidate] && this.isValidPluginClass(window[candidate], candidate)) {
                console.log(`🔍 PluginLoader: 找到有效插件类通过 window.${candidate}`);
                return window[candidate];
            }
        }

        // 第二步：查找继承自 PluginBase 的类
        const inheritanceBasedClasses = this.findClassesByInheritance();
        if (inheritanceBasedClasses.length > 0) {
            console.log(`🔍 PluginLoader: 通过继承关系找到插件类:`, inheritanceBasedClasses.map(c => c.name));
            return inheritanceBasedClasses[0].constructor;
        }

        // 第三步：查找符合插件类命名模式的类
        const nameBasedClasses = this.findClassesByNamingPattern(pluginId);
        if (nameBasedClasses.length > 0) {
            console.log(`🔍 PluginLoader: 通过命名模式找到插件类:`, nameBasedClasses.map(c => c.name));
            return nameBasedClasses[0].constructor;
        }

        console.log(`❌ PluginLoader: 未找到有效的插件类`);
        return null;
    }

    // 验证是否为有效的插件类
    isValidPluginClass(PluginClass, candidateName) {
        try {
            // 基本类型检查
            if (typeof PluginClass !== 'function') {
                console.log(`🔍 PluginLoader: ${candidateName} 不是函数`);
                return false;
            }

            // 排除异步函数（系统函数通常是异步的）
            if (PluginClass.constructor.name === 'AsyncFunction') {
                console.log(`🔍 PluginLoader: ${candidateName} 是异步函数，跳过`);
                return false;
            }

            // 排除箭头函数
            if (!PluginClass.prototype) {
                console.log(`🔍 PluginLoader: ${candidateName} 没有prototype（可能是箭头函数），跳过`);
                return false;
            }

            // 排除明显的系统函数
            if (this.isSystemFunction(PluginClass, candidateName)) {
                console.log(`🔍 PluginLoader: ${candidateName} 是系统函数，跳过`);
                return false;
            }

            // 检查是否继承自 PluginBase
            if (window.PluginBase) {
                try {
                    const extendsPluginBase = PluginClass.prototype instanceof window.PluginBase;
                    if (extendsPluginBase) {
                        console.log(`🔍 PluginLoader: ${candidateName} 继承自 PluginBase，有效`);
                        return true;
                    }
                } catch (inheritanceError) {
                    console.warn(`⚠️ PluginLoader: ${candidateName} 继承检查失败:`, inheritanceError.message);
                }
            }

            // 检查是否有必需的插件方法
            if (this.hasPluginMethods(PluginClass)) {
                console.log(`🔍 PluginLoader: ${candidateName} 有插件方法，可能有效`);
                return true;
            }

            // 尝试实例化测试
            try {
                const testInstance = new PluginClass({});
                if (testInstance && typeof testInstance === 'object') {
                    console.log(`🔍 PluginLoader: ${candidateName} 可以实例化，有效`);
                    return true;
                }
            } catch (instanceError) {
                console.log(`🔍 PluginLoader: ${candidateName} 实例化失败:`, instanceError.message);
            }

            return false;

        } catch (error) {
            console.warn(`⚠️ PluginLoader: 验证 ${candidateName} 时出现异常:`, error.message);
            return false;
        }
    }

    // 检查是否为系统函数
    isSystemFunction(func, name) {
        // 系统函数的特征
        const systemFunctionPatterns = [
            /^initialize/i,           // initializePluginSystem 等
            /^setup/i,               // setup 相关函数
            /^create/i,              // create 相关函数
            /^load/i,                // load 相关函数
            /^start/i,               // start 相关函数
            /^init/i,                // init 相关函数
            /^config/i,              // config 相关函数
            /^register/i,            // register 相关函数
            /^handle/i,              // handle 相关函数
            /^process/i,             // process 相关函数
            /^manage/i,              // manage 相关函数
            /^update/i,              // update 相关函数
            /^refresh/i,             // refresh 相关函数
            /^debug/i,               // debug 相关函数
            /^test/i                 // test 相关函数（排除测试函数）
        ];

        // 检查函数名是否匹配系统函数模式
        for (const pattern of systemFunctionPatterns) {
            if (pattern.test(name)) {
                return true;
            }
        }

        // 检查函数是否在系统命名空间中
        const systemNamespaces = ['window', 'document', 'console', 'navigator'];
        for (const namespace of systemNamespaces) {
            if (window[namespace] && window[namespace][name] === func) {
                return true;
            }
        }

        return false;
    }

    // 检查是否有插件方法
    hasPluginMethods(PluginClass) {
        const pluginMethods = ['activate', 'deactivate'];
        let methodCount = 0;
        for (const method of pluginMethods) {
            if (this.hasMethod(PluginClass, method)) {
                methodCount++;
            }
        }
        // 至少要有一个插件方法
        return methodCount > 0;
    }

    // 通过继承关系查找插件类
    findClassesByInheritance() {
        const classes = [];

        if (!window.PluginBase) {
            console.log(`🔍 PluginLoader: PluginBase 不可用，跳过继承检查`);
            return classes;
        }

        for (const key of Object.keys(window)) {
            const value = window[key];

            if (typeof value === 'function' && value.prototype) {
                try {
                    if (value.prototype instanceof window.PluginBase && value !== window.PluginBase) {
                        classes.push({
                            name: key,
                            constructor: value
                        });
                    }
                } catch (error) {}
            }
        }

        return classes;
    }

    // 通过命名模式查找插件类
    findClassesByNamingPattern(pluginId) {
        const classes = [];

        // 插件类的命名模式
        const pluginNamePatterns = [
            /Plugin$/,               // 以 Plugin 结尾
            /^.*Plugin$/,            // 任何以 Plugin 结尾的
            new RegExp(`${pluginId}`, 'i')  // 包含插件ID的
        ];

        for (const key of Object.keys(window)) {
            const value = window[key];

            // 基本检查
            if (typeof value !== 'function' || !value.prototype) {
                continue;
            }

            // 排除系统函数
            if (this.isSystemFunction(value, key)) {
                continue;
            }

            // 检查命名模式
            let matchesPattern = false;
            for (const pattern of pluginNamePatterns) {
                if (pattern.test(key)) {
                    matchesPattern = true;
                    break;
                }
            }

            if (matchesPattern && this.hasPluginMethods(value)) {
                classes.push({
                    name: key,
                    constructor: value
                });
            }
        }

        return classes;
    }

    // 验证插件类
    validatePluginClass(PluginClass, pluginId) {
        const result = {
            isValid: true,
            warnings: []
        };

        try {
            // 基本类型检查
            if (typeof PluginClass !== 'function') {
                result.isValid = false;
                result.warnings.push('插件类不是一个有效的构造函数');
                return result;
            }

            // prototype 检查
            const hasValidPrototype = this.validatePrototype(PluginClass);
            if (!hasValidPrototype.isValid) {
                result.isValid = false;
                result.warnings.push(hasValidPrototype.reason);
                return result;
            }

            // 检查是否继承自PluginBase
            if (window.PluginBase) {
                try {
                    const extendsPluginBase = PluginClass.prototype instanceof window.PluginBase;
                    if (!extendsPluginBase) {
                        result.warnings.push('插件没有正确继承PluginBase');
                    }
                } catch (inheritanceError) {
                    result.warnings.push(`继承检查失败: ${inheritanceError.message}`);
                }
            } else {
                result.warnings.push('PluginBase不可用，无法验证继承关系');
            }

            // 安全检查必需的方法
            const requiredMethods = ['activate'];
            for (const method of requiredMethods) {
                try {
                    // 使用更安全的方法检查
                    const hasMethod = this.hasMethod(PluginClass, method);
                    if (!hasMethod) {
                        result.warnings.push(`缺少必需的方法: ${method}`);
                    }
                } catch (methodCheckError) {
                    result.warnings.push(`方法检查失败 ${method}: ${methodCheckError.message}`);
                }
            }

            // 安全的验证结果记录
            const validationInfo = {
                className: PluginClass.name || 'Unknown',
                hasPrototype: !!PluginClass.prototype,
                isFunction: typeof PluginClass === 'function'
            };

            // 安全检查继承关系
            try {
                if (window.PluginBase && PluginClass.prototype) {
                    validationInfo.extendsPluginBase = PluginClass.prototype instanceof window.PluginBase;
                    validationInfo.prototypeChain = PluginClass.prototype.__proto__ === window.PluginBase.prototype;
                } else {
                    validationInfo.extendsPluginBase = 'PluginBase不可用或prototype缺失';
                }
            } catch (error) {
                validationInfo.extendsPluginBase = `检查失败: ${error.message}`;
            }

            // 安全检查方法
            try {
                validationInfo.hasActivateMethod = this.hasMethod(PluginClass, 'activate');
                validationInfo.hasDeactivateMethod = this.hasMethod(PluginClass, 'deactivate');
            } catch (error) {
                validationInfo.methodCheckError = error.message;
                validationInfo.hasActivateMethod = false;
                validationInfo.hasDeactivateMethod = false;
            }

            console.log(`🔍 PluginLoader: 插件类验证结果:`, validationInfo);

        } catch (validationError) {
            console.error(`❌ PluginLoader: 插件类验证异常:`, validationError);
            result.isValid = false;
            result.warnings.push(`验证过程中出现异常: ${validationError.message}`);
        }

        return result;
    }

    // 验证插件类的 prototype 属性
    validatePrototype(PluginClass) {
        const result = {
            isValid: false,
            reason: ''
        };

        try {
            // 函数必须有 prototype 属性（排除箭头函数）
            if (!('prototype' in PluginClass)) {
                result.reason = '插件类缺少prototype属性（可能是箭头函数）';
                return result;
            }

            // prototype 不应该是 undefined 或 null
            if (PluginClass.prototype === undefined) {
                result.reason = '插件类的prototype属性为undefined';
                return result;
            }

            if (PluginClass.prototype === null) {
                result.reason = '插件类的prototype属性为null';
                return result;
            }

            // prototype 应该是一个对象
            if (typeof PluginClass.prototype !== 'object') {
                result.reason = `插件类的prototype属性类型错误: ${typeof PluginClass.prototype}`;
                return result;
            }

            // 验证构造函数关系
            // 对于正常的类/构造函数
            try {
                if (PluginClass.prototype.constructor !== PluginClass) {
                    console.warn(`⚠️ PluginLoader: 插件类的prototype.constructor不指向自身`);
                }
            } catch (constructorError) {
                console.warn(`⚠️ PluginLoader: 构造函数关系检查失败:`, constructorError.message);
            }

            // 尝试创建一个测试实例来验证类的有效性
            try {
                const testContext = { test: true };
                const testInstance = new PluginClass(testContext);
                if (testInstance && typeof testInstance === 'object') {
                    result.isValid = true;
                    console.log(`🔍 PluginLoader: 插件类prototype验证通过，测试实例创建成功`);
                } else {
                    result.reason = '插件类实例化测试失败：创建的实例无效';
                    return result;
                }
            } catch (instanceError) {
                // 若实例化失败，可能是因为构造函数需要特定参数
                // 但这不一定意味着 prototype 无效
                console.warn(`⚠️ PluginLoader: 插件类实例化测试失败:`, instanceError.message);

                // 若实例化失败，但 prototype 结构看起来正常，仍认为是有效的
                if (PluginClass.prototype && typeof PluginClass.prototype === 'object') {
                    result.isValid = true;
                    console.log(`🔍 PluginLoader: 插件类prototype验证通过（跳过实例化测试）`);
                } else {
                    result.reason = `插件类实例化失败且prototype结构异常: ${instanceError.message}`;
                    return result;
                }
            }

        } catch (validationError) {
            result.reason = `prototype验证过程中出现异常: ${validationError.message}`;
            return result;
        }

        return result;
    }

    // 安全检查插件类是否有指定方法
    hasMethod(PluginClass, methodName) {
        try {
            // 直接在 prototype 上查找
            if (PluginClass.prototype && typeof PluginClass.prototype[methodName] === 'function') {
                return true;
            }

            // 通过原型链查找
            // 处理继承
            if (PluginClass.prototype) {
                const descriptor = Object.getOwnPropertyDescriptor(PluginClass.prototype, methodName);
                if (descriptor && typeof descriptor.value === 'function') {
                    return true;
                }
            }

            // 创建临时实例检查
            try {
                const tempInstance = new PluginClass({});
                if (tempInstance && typeof tempInstance[methodName] === 'function') {
                    return true;
                }
            } catch (instanceError) {
                console.warn(`⚠️ PluginLoader: 临时实例创建失败，跳过实例方法检查:`, instanceError.message);
            }

            // 在原型链中查找
            let currentProto = PluginClass.prototype;
            while (currentProto) {
                if (currentProto.hasOwnProperty(methodName) && typeof currentProto[methodName] === 'function') {
                    return true;
                }
                currentProto = Object.getPrototypeOf(currentProto);

                // 防止无限循环
                if (currentProto === Object.prototype) {
                    break;
                }
            }

            return false;

        } catch (error) {
            console.warn(`⚠️ PluginLoader: 方法检查异常 ${methodName}:`, error.message);
            return false;
        }
    }

    // 记录插件类调试信息
    logPluginClassDebugInfo(pluginId) {
        console.log(`🔍 PluginLoader: ===== 插件类调试信息 ${pluginId} =====`);

        // 检查所有包含 'plugin' 的全局变量
        const allPluginGlobals = Object.keys(window).filter(k => k.toLowerCase().includes('plugin'));
        console.log(`🔍 PluginLoader: 所有包含'plugin'的全局变量 (${allPluginGlobals.length}):`, allPluginGlobals);

        // 详细分析每个包含 'plugin' 的全局变量
        allPluginGlobals.forEach(key => {
            const value = window[key];
            console.log(`  - ${key}:`, {
                type: typeof value,
                isFunction: typeof value === 'function',
                isAsync: typeof value === 'function' && value.constructor.name === 'AsyncFunction',
                hasPrototype: typeof value === 'function' ? !!value.prototype : false,
                isSystemFunction: typeof value === 'function' ? this.isSystemFunction(value, key) : false,
                isValidPlugin: typeof value === 'function' ? this.isValidPluginClass(value, key) : false
            });
        });

        // 检查标准候选项
        const standardCandidates = ['PluginClass', 'Plugin', `Plugin_${pluginId}`, 'default'];
        console.log(`🔍 PluginLoader: 标准候选项检查:`);
        standardCandidates.forEach(candidate => {
            const value = window[candidate];
            console.log(`  - window.${candidate}:`, {
                exists: !!value,
                type: typeof value,
                isValid: value ? this.isValidPluginClass(value, candidate) : false
            });
        });

        // 通过继承关系查找
        const inheritanceClasses = this.findClassesByInheritance();
        console.log(`🔍 PluginLoader: 通过继承关系找到的类 (${inheritanceClasses.length}):`,
                   inheritanceClasses.map(c => c.name));

        // 通过命名模式查找
        const namingClasses = this.findClassesByNamingPattern(pluginId);
        console.log(`🔍 PluginLoader: 通过命名模式找到的类 (${namingClasses.length}):`,
                   namingClasses.map(c => c.name));

        // 检查PluginBase的可用性
        console.log(`🔍 PluginLoader: PluginBase状态:`, {
            exists: !!window.PluginBase,
            type: typeof window.PluginBase,
            hasPrototype: window.PluginBase ? !!window.PluginBase.prototype : false,
            prototypeKeys: window.PluginBase?.prototype ? Object.getOwnPropertyNames(window.PluginBase.prototype) : []
        });

        // 模拟查找过程
        console.log(`🔍 PluginLoader: 模拟查找过程:`);
        const foundClass = this.findPluginClass(pluginId);
        console.log(`  - 找到的类:`, foundClass);
        console.log(`  - 类名:`, foundClass ? foundClass.name : 'null');
        console.log(`  - 是否有效:`, foundClass ? this.isValidPluginClass(foundClass, foundClass.name) : false);
    }

    // UTF-8 安全的 Base64 解码函数
    decodeBase64ToUTF8(base64String) {
        try {
            // 首先尝试标准的 atob 解码
            const binaryString = atob(base64String);

            // 检查是否需要 UTF-8 解码
            if (this.needsUTF8Decoding(binaryString)) {
                console.log(`🔧 PluginLoader: 检测到需要 UTF-8 解码`);

                // 将二进制字符串转换为字节数组
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // 使用 TextDecoder 解码 UTF-8
                const decoder = new TextDecoder('utf-8');
                const decodedString = decoder.decode(bytes);

                console.log(`🔧 PluginLoader: UTF-8 解码完成，原长度: ${binaryString.length}, 解码后长度: ${decodedString.length}`);
                return decodedString;

            } else {
                console.log(`🔧 PluginLoader: 使用标准解码，无需 UTF-8 处理`);
                return binaryString;
            }

        } catch (error) {
            console.error(`❌ PluginLoader: UTF-8 Base64 解码失败:`, error);

            // 如果 UTF-8 解码失败，尝试标准解码作为备用
            try {
                console.log(`🔧 PluginLoader: 尝试标准 atob 解码作为备用`);
                return atob(base64String);
            } catch (fallbackError) {
                console.error(`❌ PluginLoader: 备用解码也失败:`, fallbackError);
                throw new Error(`Base64 解码失败: ${error.message}`);
            }
        }
    }

    // 检查是否需要 UTF-8 解码
    needsUTF8Decoding(binaryString) {
        try {
            // 检查是否包含高位字节
            // 可能是 UTF-8 编码的字节
            for (let i = 0; i < Math.min(binaryString.length, 1000); i++) {
                const charCode = binaryString.charCodeAt(i);

                // 如果发现 UTF-8 字节序列的特征
                if (charCode >= 0xC0 && charCode <= 0xF4) {
                    // 检查是否符合 UTF-8 多字节序列
                    if (i + 1 < binaryString.length) {
                        const nextCharCode = binaryString.charCodeAt(i + 1);
                        if (nextCharCode >= 0x80 && nextCharCode <= 0xBF) {
                            return true;
                        }
                    }
                }
            }

            // 检查是否包含常见的中文字符编码模式
            const utf8Pattern = /[\xC0-\xF4][\x80-\xBF]+/;
            return utf8Pattern.test(binaryString);

        } catch (error) {
            console.warn(`⚠️ PluginLoader: UTF-8 检测失败:`, error);
            return false;
        }
    }

    // 验证Base64格式
    validateBase64Format(base64String) {
        const validation = {
            isValid: true,
            issues: [],
            characteristics: {}
        };

        try {
            // 检查Base64字符集
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            validation.characteristics.hasValidCharacters = base64Regex.test(base64String);

            if (!validation.characteristics.hasValidCharacters) {
                validation.issues.push('包含无效的Base64字符');
                validation.isValid = false;
            }

            // 检查长度
            // 应是4的倍数
            validation.characteristics.length = base64String.length;
            validation.characteristics.isValidLength = base64String.length % 4 === 0;

            if (!validation.characteristics.isValidLength) {
                validation.issues.push('长度不是4的倍数');
            }

            // 检查填充
            const paddingCount = (base64String.match(/=/g) || []).length;
            validation.characteristics.paddingCount = paddingCount;
            validation.characteristics.hasValidPadding = paddingCount <= 2;

            if (!validation.characteristics.hasValidPadding) {
                validation.issues.push('填充字符过多');
            }

            // 尝试解码测试
            try {
                const testDecode = atob(base64String.substring(0, Math.min(100, base64String.length)));
                validation.characteristics.canDecode = true;
                validation.characteristics.decodedSample = testDecode.substring(0, 50);
            } catch (decodeError) {
                validation.characteristics.canDecode = false;
                validation.issues.push(`解码测试失败: ${decodeError.message}`);
                validation.isValid = false;
            }

        } catch (error) {
            validation.isValid = false;
            validation.issues.push(`验证过程异常: ${error.message}`);
        }

        return validation;
    }

    // 分析解码后的内容
    analyzeDecodedContent(content, pluginId) {
        const analysis = {
            length: content.length,
            isNumericArray: false,
            isJavaScript: false,
            hasCommas: false,
            lineCount: 0,
            characteristics: {}
        };

        try {
            // 检查是否包含逗号
            // 数字数组的特征
            analysis.hasCommas = content.includes(',');

            // 检查是否是数字数组格式
            const commaCount = (content.match(/,/g) || []).length;
            const numberPattern = /^\d+(?:,\d+)*$/;
            analysis.isNumericArray = numberPattern.test(content.trim()) ||
                                     (analysis.hasCommas && commaCount > 100);

            // 检查是否是JavaScript代码
            const jsKeywords = ['class', 'function', 'const', 'let', 'var', 'async', 'await'];
            analysis.isJavaScript = jsKeywords.some(keyword => content.includes(keyword));

            // 行数统计
            analysis.lineCount = content.split('\n').length;

            // 字符特征分析
            analysis.characteristics = {
                hasClassKeyword: content.includes('class'),
                hasPluginBase: content.includes('PluginBase'),
                hasWindowPluginClass: content.includes('window.PluginClass'),
                hasActivateMethod: content.includes('activate'),
                hasAsyncKeyword: content.includes('async'),
                startsWithNumber: /^\d/.test(content.trim()),
                endsWithNumber: /\d$/.test(content.trim()),
                averageLineLength: analysis.lineCount > 0 ? content.length / analysis.lineCount : 0
            };

            // 内容预览
            analysis.preview = {
                start: content.substring(0, 100),
                end: content.substring(Math.max(0, content.length - 100))
            };

            console.log(`🔍 PluginLoader: 内容分析详情 ${pluginId}:`, {
                isNumericArray: analysis.isNumericArray,
                isJavaScript: analysis.isJavaScript,
                commaCount: commaCount,
                firstChars: content.substring(0, 20),
                lastChars: content.substring(Math.max(0, content.length - 20))
            });

        } catch (error) {
            console.error(`❌ PluginLoader: 内容分析异常:`, error);
            analysis.error = error.message;
        }

        return analysis;
    }

    // 修复数字数组内容
    fixNumericArrayContent(content, pluginId) {
        try {
            console.log(`🔧 PluginLoader: 开始修复数字数组内容 ${pluginId}`);

            // 将逗号分隔的数字转换回字符串
            const numbers = content.split(',').map(num => parseInt(num.trim(), 10));
            console.log(`🔧 PluginLoader: 解析到 ${numbers.length} 个数字`);

            // 检查数字是否在有效范围内
            // 0-255，UTF-8字节范围
            const validNumbers = numbers.filter(num => !isNaN(num) && num >= 0 && num <= 255);
            console.log(`🔧 PluginLoader: 有效数字: ${validNumbers.length}/${numbers.length}`);

            if (validNumbers.length === numbers.length && validNumbers.length > 0) {
                // 将数字数组转换为Uint8Array，然后解码为字符串
                const uint8Array = new Uint8Array(validNumbers);
                const decoder = new TextDecoder('utf-8');
                const fixedContent = decoder.decode(uint8Array);

                console.log(`🔧 PluginLoader: 修复成功，原长度: ${content.length}, 修复后长度: ${fixedContent.length}`);
                console.log(`🔧 PluginLoader: 修复后内容预览: ${fixedContent.substring(0, 100)}...`);

                return fixedContent;
            } else {
                console.warn(`⚠️ PluginLoader: 无法修复，数字格式无效`);
                return content;
            }

        } catch (error) {
            console.error(`❌ PluginLoader: 修复数字数组内容失败:`, error);
            return content;
        }
    }

    // 验证插件代码
    validatePluginCode(code, pluginId) {
        const validation = {
            isValid: true,
            issues: [],
            hasClass: false,
            hasPluginBase: false,
            hasExtends: false,
            hasExport: false,
            hasActivate: false
        };

        try {
            // 基本结构检查
            validation.hasClass = code.includes('class ');
            validation.hasPluginBase = code.includes('PluginBase');
            validation.hasExtends = code.includes('extends');
            validation.hasExport = code.includes('window.PluginClass') ||
                                  code.includes('module.exports') ||
                                  code.includes('export');
            validation.hasActivate = code.includes('activate');

            // 检查必需元素
            if (!validation.hasClass) {
                validation.issues.push('缺少类定义');
                validation.isValid = false;
            }

            if (!validation.hasPluginBase) {
                validation.issues.push('未引用PluginBase');
            }

            if (!validation.hasExtends) {
                validation.issues.push('类未继承其他类');
            }

            if (!validation.hasExport) {
                validation.issues.push('缺少导出语句');
                validation.isValid = false;
            }

            if (!validation.hasActivate) {
                validation.issues.push('缺少activate方法');
            }

            // 检查代码完整性
            const lines = code.split('\n');
            if (lines.length < 5) {
                validation.issues.push('代码行数过少，可能不完整');
            }

            // 检查语法错误的常见模式
            if (code.includes('undefined') && code.includes('class')) {
                validation.issues.push('代码中包含undefined，可能存在语法错误');
            }

        } catch (error) {
            validation.isValid = false;
            validation.issues.push(`验证过程中出现异常: ${error.message}`);
        }

        return validation;
    }

    // 修复常见的代码问题
    fixCommonCodeIssues(code, pluginId) {
        let fixedCode = code;

        try {
            // 修复缺少导出语句的问题
            if (!fixedCode.includes('window.PluginClass') &&
                !fixedCode.includes('module.exports') &&
                !fixedCode.includes('export')) {

                // 尝试找到类名
                const classMatch = fixedCode.match(/class\s+(\w+)\s+extends/);
                if (classMatch) {
                    const className = classMatch[1];
                    fixedCode += `\n\n// 自动添加的导出语句\nwindow.PluginClass = ${className};`;
                    console.log(`🔧 PluginLoader: 自动添加导出语句: window.PluginClass = ${className}`);
                }
            }

            // 修复编码问题导致的特殊字符
            fixedCode = fixedCode.replace(/[^\x00-\x7F]/g, '');

            // 移除可能的BOM标记
            fixedCode = fixedCode.replace(/^\uFEFF/, '');

            // 确保代码以换行符结尾
            if (!fixedCode.endsWith('\n')) {
                fixedCode += '\n';
            }

        } catch (error) {
            console.error(`❌ PluginLoader: 修复代码时出现错误:`, error);
        }

        return fixedCode;
    }

    // 记录代码预览
    logCodePreview(code, pluginId) {
        try {
            const lines = code.split('\n');
            console.log(`🔍 PluginLoader: 代码总行数: ${lines.length}`);

            // 显示前几行和后几行
            const previewLines = 3;
            console.log(`🔍 PluginLoader: 前${previewLines}行:`, lines.slice(0, previewLines));
            console.log(`🔍 PluginLoader: 后${previewLines}行:`, lines.slice(-previewLines));

            // 查找关键行
            const classLine = lines.find(line => line.trim().startsWith('class '));
            const exportLine = lines.find(line => line.includes('window.PluginClass'));
            const activateLine = lines.find(line => line.includes('activate'));

            console.log(`🔍 PluginLoader: 关键代码行:`, {
                classDefinition: classLine?.trim(),
                exportStatement: exportLine?.trim(),
                activateMethod: activateLine?.trim()
            });

        } catch (error) {
            console.error(`❌ PluginLoader: 记录代码预览时出现错误:`, error);
        }
    }

    // 加载外部脚本文件
    loadExternalScript(scriptPath, pluginId, resolve, reject) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;

        script.onload = () => {
            try {
                console.log(`🔌 PluginLoader: 外部脚本加载完成 ${scriptPath}`);

                // 使用统一的插件类查找机制
                setTimeout(() => {
                    const PluginClass = this.findPluginClass(pluginId);

                    if (PluginClass && typeof PluginClass === 'function') {
                        console.log(`✅ PluginLoader: 外部插件加载成功 ${pluginId}`);

                        // 验证插件类
                        const validationResult = this.validatePluginClass(PluginClass, pluginId);

                        // 创建标准的模块导出格式
                        const moduleExport = {
                            default: PluginClass,
                            PluginClass: PluginClass,
                            [PluginClass.name]: PluginClass
                        };

                        if (validationResult.isValid) {
                            resolve(moduleExport);
                        } else {
                            console.warn(`⚠️ PluginLoader: 外部插件验证警告:`, validationResult.warnings);

                            // 检查是否有严重错误
                            const hasCriticalError = validationResult.warnings.some(warning =>
                                warning.includes('不是一个有效的构造函数') ||
                                warning.includes('缺少prototype属性')
                            );

                            if (hasCriticalError) {
                                const error = new Error(`外部插件类验证失败: ${validationResult.warnings.join(', ')}`);
                                console.error(`❌ PluginLoader: ${error.message}`);
                                reject(error);
                            } else {
                                resolve(moduleExport);
                            }
                        }
                    } else {
                        const error = new Error(`外部插件类未找到: ${pluginId}`);
                        console.error(`❌ PluginLoader: ${error.message}`);
                        this.logPluginClassDebugInfo(pluginId);
                        reject(error);
                    }
                }, 10);

            } catch (error) {
                console.error(`❌ PluginLoader: 外部插件处理失败 ${pluginId}:`, error);
                reject(error);
            } finally {
                // 延迟移除脚本，确保插件类已经被正确导出
                setTimeout(() => {
                    if (script.parentNode) {
                        document.head.removeChild(script);
                    }
                }, 100);
            }
        };

        script.onerror = (error) => {
            console.error(`❌ PluginLoader: 外部脚本加载失败 ${scriptPath}:`, error);
            if (script.parentNode) {
                document.head.removeChild(script);
            }
            reject(new Error(`脚本加载失败: ${scriptPath}`));
        };

        script.src = scriptPath;
        document.head.appendChild(script);
    }

    // 卸载插件脚本
    unloadPluginScript(pluginId) {
        try {
            // 移除缓存
            this.pluginModules.delete(pluginId);
            this.loadedScripts.delete(pluginId);
            
            // 停止文件监听
            if (this.watchedFiles.has(pluginId)) {
                this.unwatchFile(pluginId);
            }
            
            console.log(`✅ PluginLoader: 插件脚本 ${pluginId} 已卸载`);
            
        } catch (error) {
            console.error(`❌ PluginLoader: 卸载插件脚本失败 ${pluginId}:`, error);
        }
    }

    // 重新加载插件脚本（热重载）
    async reloadPluginScript(pluginId) {
        try {
            console.log(`🔥 PluginLoader: 开始热重载插件 ${pluginId}`);
            
            // 获取配置
            const config = window.pluginManager?.pluginConfigs.get(pluginId);
            if (!config) {
                throw new Error(`插件配置不存在: ${pluginId}`);
            }
            
            // 先卸载
            this.unloadPluginScript(pluginId);
            
            // 重新加载
            const module = await this.loadPluginScript(config);
            
            this.emit('pluginReloaded', { pluginId, module });
            console.log(`✅ PluginLoader: 插件 ${pluginId} 热重载成功`);
            
            return module;
            
        } catch (error) {
            console.error(`❌ PluginLoader: 热重载插件失败 ${pluginId}:`, error);
            throw error;
        }
    }

    // 监听文件变化（热重载）
    watchFile(pluginId, filePath) {
        if (!this.isHotReloadEnabled) return;
        
        // 暂时用简单的文件监听实现
        const watchInfo = {
            pluginId,
            filePath,
            lastModified: Date.now()
        };
        
        this.watchedFiles.set(pluginId, watchInfo);
        console.log(`👁️ PluginLoader: 开始监听文件 ${filePath}`);
    }

    // 停止监听文件
    unwatchFile(pluginId) {
        this.watchedFiles.delete(pluginId);
        console.log(`👁️ PluginLoader: 停止监听插件文件 ${pluginId}`);
    }

    // 检查文件变化
    checkFileChanges() {
        if (!this.isHotReloadEnabled) return;
        
        for (const [pluginId, watchInfo] of this.watchedFiles) {
            // 实现文件变化检测逻辑
        }
    }

    // 验证插件格式
    validatePlugin(config) {
        const required = ['id', 'name', 'version', 'main'];
        const missing = required.filter(field => !config[field]);
        
        if (missing.length > 0) {
            throw new Error(`插件配置缺少必需字段: ${missing.join(', ')}`);
        }
        
        // 验证版本格式
        if (!/^\d+\.\d+\.\d+/.test(config.version)) {
            throw new Error('插件版本格式无效，应为 x.y.z 格式');
        }
        
        // 验证插件ID格式
        if (!/^[a-zA-Z0-9_-]+$/.test(config.id)) {
            throw new Error('插件ID只能包含字母、数字、下划线和连字符');
        }
        
        return true;
    }

    // 获取插件信息
    getPluginInfo(pluginId) {
        return {
            id: pluginId,
            loaded: this.loadedScripts.has(pluginId),
            scriptPath: this.loadedScripts.get(pluginId),
            module: this.pluginModules.get(pluginId),
            watched: this.watchedFiles.has(pluginId)
        };
    }

    // 获取所有已加载的插件
    getAllLoadedPlugins() {
        const plugins = [];
        for (const pluginId of this.loadedScripts.keys()) {
            plugins.push(this.getPluginInfo(pluginId));
        }
        return plugins;
    }

    // 清理所有资源
    cleanup() {
        // 卸载所有插件脚本
        for (const pluginId of this.loadedScripts.keys()) {
            this.unloadPluginScript(pluginId);
        }
        
        // 清理缓存
        this.loadedScripts.clear();
        this.pluginModules.clear();
        this.watchedFiles.clear();
    }
}

window.PluginLoader = PluginLoader;
