/**
 * 编辑元数据环境设置脚本
 * 检查并安装Python环境和mutagen库
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MetadataSetup {
    constructor() {
        this.pythonPath = null;
        this.setupLog = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        this.setupLog.push(logEntry);
        console.log(logEntry);
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve) => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            child.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    stdout: '',
                    stderr: error.message
                });
            });
        });
    }

    async detectPython() {
        this.log('开始检测Python环境...');
        const pythonCommands = ['python3', 'python', 'py'];
        
        for (const cmd of pythonCommands) {
            try {
                const result = await this.runCommand(cmd, ['--version']);
                if (result.success && result.stdout.includes('Python')) {
                    this.pythonPath = cmd;
                    this.log(`✅ 检测到Python: ${cmd} - ${result.stdout}`);
                    return true;
                }
            } catch (error) {
                this.log(`❌ 检测${cmd}失败: ${error.message}`, 'warn');
            }
        }
        
        this.log('❌ 未检测到Python环境', 'error');
        return false;
    }

    async checkMutagen() {
        if (!this.pythonPath) {
            return false;
        }

        this.log('检查mutagen库...');
        try {
            const result = await this.runCommand(this.pythonPath, ['-c', 'import mutagen; print("mutagen", mutagen.version_string)']);
            if (result.success && result.stdout.includes('mutagen')) {
                this.log(`✅ mutagen库已安装: ${result.stdout}`);
                return true;
            }
        } catch (error) {
            this.log(`❌ mutagen库检查失败: ${error.message}`, 'warn');
        }

        return false;
    }

    async installMutagen() {
        if (!this.pythonPath) {
            this.log('❌ Python环境不可用，无法安装mutagen', 'error');
            return false;
        }

        this.log('开始安装mutagen库...');
        
        // 尝试使用pip安装
        const pipCommands = ['pip3', 'pip', `${this.pythonPath} -m pip`];
        
        for (const pipCmd of pipCommands) {
            try {
                this.log(`尝试使用 ${pipCmd} 安装mutagen...`);
                const args = pipCmd.includes('python') ? 
                    pipCmd.split(' ').slice(1).concat(['install', 'mutagen']) :
                    [pipCmd, 'install', 'mutagen'];
                
                const result = await this.runCommand(args[0], args.slice(1));
                
                if (result.success) {
                    this.log('✅ mutagen库安装成功');
                    return true;
                } else {
                    this.log(`❌ ${pipCmd} 安装失败: ${result.stderr}`, 'warn');
                }
            } catch (error) {
                this.log(`❌ ${pipCmd} 安装异常: ${error.message}`, 'warn');
            }
        }

        this.log('❌ 所有pip安装方法都失败', 'error');
        return false;
    }

    async createRequirementsFile() {
        const requirementsPath = path.join(__dirname, '..', 'requirements.txt');
        const requirements = 'mutagen>=1.45.0\n';
        
        try {
            fs.writeFileSync(requirementsPath, requirements);
            this.log(`✅ 创建requirements.txt文件: ${requirementsPath}`);
            return requirementsPath;
        } catch (error) {
            this.log(`❌ 创建requirements.txt失败: ${error.message}`, 'error');
            return null;
        }
    }

    async generateSetupReport() {
        const reportPath = path.join(__dirname, '..', 'metadata-setup-report.txt');
        const report = [
            '=== MusicBox 元数据支持环境设置报告 ===',
            `设置时间: ${new Date().toISOString()}`,
            `Python路径: ${this.pythonPath || '未检测到'}`,
            '',
            '=== 设置日志 ===',
            ...this.setupLog,
            '',
            '=== 使用说明 ===',
            '如果Python环境或mutagen库不可用，应用将只支持MP3格式的元数据修改。',
            '要获得完整的多格式支持，请：',
            '1. 安装Python 3.6或更高版本',
            '2. 运行: pip install mutagen',
            '3. 重启应用',
            ''
        ].join('\n');

        try {
            fs.writeFileSync(reportPath, report);
            this.log(`✅ 生成设置报告: ${reportPath}`);
        } catch (error) {
            this.log(`❌ 生成设置报告失败: ${error.message}`, 'error');
        }
    }

    async setup() {
        this.log('=== 开始MusicBox元数据支持环境设置 ===');

        // 检测Python
        const pythonAvailable = await this.detectPython();
        if (!pythonAvailable) {
            this.log('⚠️ 未检测到Python环境，将只支持MP3格式的元数据修改', 'warn');
            await this.generateSetupReport();
            return false;
        }

        // 检查mutagen
        const mutagenAvailable = await this.checkMutagen();
        if (mutagenAvailable) {
            this.log('✅ 元数据支持环境已就绪');
            await this.generateSetupReport();
            return true;
        }

        // 安装mutagen
        this.log('mutagen库未安装，尝试自动安装...');
        const installSuccess = await this.installMutagen();
        
        if (installSuccess) {
            // 再次验证安装
            const verifySuccess = await this.checkMutagen();
            if (verifySuccess) {
                this.log('✅ 元数据支持环境设置完成');
                await this.generateSetupReport();
                return true;
            }
        }

        // 创建requirements文件供手动安装
        await this.createRequirementsFile();
        this.log('⚠️ 自动安装失败，请手动安装mutagen库', 'warn');
        this.log('手动安装命令: pip install mutagen', 'info');
        
        await this.generateSetupReport();
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const setup = new MetadataSetup();
    setup.setup().then((success) => {
        process.exit(success ? 0 : 1);
    }).catch((error) => {
        console.error('设置过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = MetadataSetup;
