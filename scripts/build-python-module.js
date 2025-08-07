
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class PythonModuleBuilder {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.srcMain = path.join(this.projectRoot, 'src', 'main');
        this.distDir = path.join(this.projectRoot, 'dist', 'python-modules');
        this.pythonScript = path.join(this.srcMain, 'metadata_editor.py');
        this.requirementsFile = path.join(this.projectRoot, 'requirements.txt');
        this.specFile = path.join(this.projectRoot, 'pyinstaller.spec');
        
        this.platform = os.platform();
        this.arch = os.arch();
        this.executableName = this.platform === 'win32' ? 'metadata_editor.exe' : 'metadata_editor';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '📦',
            'success': '✅',
            'error': '❌',
            'warn': '⚠️'
        }[type] || 'ℹ️';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve) => {
            this.log(`执行命令: ${command} ${args.join(' ')}`);
            
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: this.projectRoot,
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // 实时显示输出
                process.stdout.write(output);
            });

            child.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                // 实时显示错误输出
                process.stderr.write(output);
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

    async checkPython() {
        this.log('检查Python环境...');
        const pythonCommands = ['python3', 'python', 'py'];
        
        for (const cmd of pythonCommands) {
            try {
                const result = await this.runCommand(cmd, ['--version']);
                if (result.success && result.stdout.includes('Python')) {
                    this.pythonPath = cmd;
                    this.log(`找到Python: ${cmd} - ${result.stdout}`, 'success');
                    return true;
                }
            } catch (error) {
                this.log(`检测${cmd}失败: ${error.message}`, 'warn');
            }
        }
        
        this.log('未找到Python环境', 'error');
        return false;
    }

    async installDependencies() {
        if (!this.pythonPath) {
            throw new Error('Python环境不可用');
        }
        this.log('安装Python依赖...');
        const result = await this.runCommand(this.pythonPath, ['-m', 'pip', 'install', '-r', this.requirementsFile]);
        if (!result.success) {
            throw new Error(`安装依赖失败: ${result.stderr}`);
        }
        
        // 安装PyInstaller
        this.log('安装PyInstaller...');
        const pyinstallerResult = await this.runCommand(this.pythonPath, ['-m', 'pip', 'install', 'pyinstaller']);
        if (!pyinstallerResult.success) {
            throw new Error(`安装PyInstaller失败: ${pyinstallerResult.stderr}`);
        }
        this.log('依赖安装完成', 'success');
    }

    async buildWithPyInstaller() {
        this.log('使用PyInstaller打包...');
        
        // 确保输出目录存在
        if (!fs.existsSync(this.distDir)) {
            fs.mkdirSync(this.distDir, { recursive: true });
        }
        
        const args = [
            '-m', 'PyInstaller',
            '--distpath', this.distDir,
            '--workpath', path.join(this.projectRoot, 'build', 'pyinstaller'),
            this.specFile
        ];
        
        const result = await this.runCommand(this.pythonPath, args);
        if (!result.success) {
            throw new Error(`PyInstaller打包失败: ${result.stderr}`);
        }
        
        // 检查生成的可执行文件
        const executablePath = path.join(this.distDir, this.executableName);
        if (!fs.existsSync(executablePath)) {
            throw new Error(`可执行文件未生成: ${executablePath}`);
        }
        
        this.log(`PyInstaller打包成功: ${executablePath}`, 'success');
        return executablePath;
    }

    async buildWithNuitka() {
        this.log('使用Nuitka打包（备用方案）...');
        
        // 安装Nuitka
        this.log('安装Nuitka...');
        const installResult = await this.runCommand(this.pythonPath, ['-m', 'pip', 'install', 'nuitka']);
        if (!installResult.success) {
            throw new Error(`安装Nuitka失败: ${installResult.stderr}`);
        }
        
        // 确保输出目录存在
        if (!fs.existsSync(this.distDir)) {
            fs.mkdirSync(this.distDir, { recursive: true });
        }
        
        const args = [
            '-m', 'nuitka',
            '--main=' + this.pythonScript,
            '--output-filename=' + this.executableName,
            '--output-dir=' + this.distDir,
            '--onefile',
            '--assume-yes-for-downloads',
            '--enable-plugin=anti-bloat',
            '--include-package=mutagen'
        ];
        
        const result = await this.runCommand(this.pythonPath, args);
        if (!result.success) {
            throw new Error(`Nuitka打包失败: ${result.stderr}`);
        }
        
        const executablePath = path.join(this.distDir, this.executableName);
        this.log(`Nuitka打包成功: ${executablePath}`, 'success');
        return executablePath;
    }

    async testExecutable(executablePath) {
        this.log('测试打包后的可执行文件...');
        
        // 测试版本信息
        const result = await this.runCommand(executablePath, ['--help']);
        if (!result.success) {
            this.log('可执行文件测试失败', 'error');
            return false;
        }
        
        this.log('可执行文件测试通过', 'success');
        return true;
    }

    async copyToMainDirectory(executablePath) {
        const targetPath = path.join(this.srcMain, this.executableName);
        
        try {
            fs.copyFileSync(executablePath, targetPath);
            this.log(`可执行文件已复制到: ${targetPath}`, 'success');
            
            // 在Unix系统上设置执行权限
            if (this.platform !== 'win32') {
                fs.chmodSync(targetPath, 0o755);
            }
            
            return targetPath;
        } catch (error) {
            throw new Error(`复制可执行文件失败: ${error.message}`);
        }
    }

    async build() {
        try {
            this.log('开始Python模块打包流程...');
            
            // 检查Python环境
            if (!(await this.checkPython())) {
                throw new Error('Python环境检查失败');
            }
            
            // 安装依赖
            await this.installDependencies();
            
            let executablePath;
            
            // 尝试PyInstaller打包
            try {
                executablePath = await this.buildWithPyInstaller();
            } catch (error) {
                this.log(`PyInstaller打包失败，尝试Nuitka: ${error.message}`, 'warn');

                try {
                    executablePath = await this.buildWithNuitka();
                } catch (nuitkaError) {
                    throw new Error(`所有打包方案都失败了。PyInstaller: ${error.message}, Nuitka: ${nuitkaError.message}`);
                }
            }
            
            // 测试可执行文件
            if (!(await this.testExecutable(executablePath))) {
                throw new Error('可执行文件测试失败');
            }
            
            // 复制到主目录
            const finalPath = await this.copyToMainDirectory(executablePath);
            this.log(`Python模块打包完成！可执行文件位置: ${finalPath}`, 'success');
            
            // 输出文件信息
            const stats = fs.statSync(finalPath);
            this.log(`文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            return finalPath;
        } catch (error) {
            this.log(`打包失败: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

async function main() {
    const builder = new PythonModuleBuilder();
    await builder.build();
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ 打包过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = PythonModuleBuilder;
