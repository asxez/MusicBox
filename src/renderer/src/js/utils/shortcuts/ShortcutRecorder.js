/**
 * 快捷键录制器
 * 负责捕获用户按键并转换为快捷键字符串
 */

import {EventEmitter} from "@utils";

class ShortcutRecorder extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.pressedKeys = new Set();
        this.recordedKeys = [];
        this.currentElement = null;

        // 绑定事件处理器
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    /**
     * 开始录制快捷键
     */
    startRecording(element) {
        if (this.isRecording) {
            this.stopRecording();
        }

        this.isRecording = true;
        this.currentElement = element;
        this.pressedKeys.clear();
        this.recordedKeys = [];

        // 添加事件监听器
        document.addEventListener('keydown', this.handleKeyDown, true);
        document.addEventListener('keyup', this.handleKeyUp, true);
        window.addEventListener('blur', this.handleBlur);

        // 更新UI状态
        if (element) {
            element.classList.add('recording');
            element.textContent = '请按下快捷键...';
            element.setAttribute('data-recording', 'true');
        }

        console.log('🎹 开始录制快捷键');
        this.emit('recordingStarted');
    }

    /**
     * 停止录制快捷键
     */
    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('keyup', this.handleKeyUp, true);
        window.removeEventListener('blur', this.handleBlur);

        // 更新UI状态
        if (this.currentElement) {
            this.currentElement.classList.remove('recording');
            this.currentElement.removeAttribute('data-recording');
        }

        console.log('🎹 停止录制快捷键');
        this.emit('recordingStopped');

        this.currentElement = null;
        this.pressedKeys.clear();
    }

    /**
     * 处理按键按下事件
     */
    handleKeyDown(event) {
        if (!this.isRecording) return;

        event.preventDefault();
        event.stopPropagation();

        const key = this.normalizeKey(event);
        if (!key) return;

        // 添加到按下的键集合
        this.pressedKeys.add(key);

        // 检查是否是完整的快捷键组合
        if (this.isCompleteShortcut(event)) {
            const shortcutString = this.generateShortcutString();
            this.recordedKeys = Array.from(this.pressedKeys);

            console.log('🎹 录制到快捷键:', shortcutString);
            this.emit('shortcutRecorded', shortcutString, this.recordedKeys);

            // 更新显示
            if (this.currentElement) {
                this.currentElement.textContent = shortcutString;
            }

            // 延迟停止录制，让用户看到结果
            setTimeout(() => {
                this.stopRecording();
            }, 500);
        } else {
            // 更新显示当前按下的键
            const currentKeys = this.generateShortcutString();
            if (this.currentElement && currentKeys) {
                this.currentElement.textContent = currentKeys + '...';
            }
        }
    }

    /**
     * 处理按键释放事件
     */
    handleKeyUp(event) {
        if (!this.isRecording) return;

        const key = this.normalizeKey(event);
        if (key) {
            this.pressedKeys.delete(key);
        }

        // 如果所有键都释放了，重置显示
        if (this.pressedKeys.size === 0 && this.currentElement) {
            this.currentElement.textContent = '请按下快捷键...';
        }
    }

    /**
     * 处理窗口失焦事件
     */
    handleBlur() {
        if (this.isRecording) {
            this.stopRecording();
        }
    }

    /**
     * 标准化按键名称
     */
    normalizeKey(event) {
        const key = event.key;
        const code = event.code;

        // 修饰键
        if (key === 'Control') return 'Ctrl';
        if (key === 'Alt') return 'Alt';
        if (key === 'Shift') return 'Shift';
        if (key === 'Meta') return 'Cmd';

        // 特殊键
        if (key === ' ') return 'Space';
        if (key === 'Escape') return 'Escape';
        if (key === 'Enter') return 'Enter';
        if (key === 'Tab') return 'Tab';
        if (key === 'Backspace') return 'Backspace';
        if (key === 'Delete') return 'Delete';

        // 方向键
        if (key === 'ArrowUp') return 'ArrowUp';
        if (key === 'ArrowDown') return 'ArrowDown';
        if (key === 'ArrowLeft') return 'ArrowLeft';
        if (key === 'ArrowRight') return 'ArrowRight';

        // 功能键
        if (key.startsWith('F') && key.length <= 3) return key;

        // 字母和数字
        if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
            return key.toUpperCase();
        }

        // 其他特殊字符
        const specialKeys = {
            '`': 'Backquote',
            '-': 'Minus',
            '=': 'Equal',
            '[': 'BracketLeft',
            ']': 'BracketRight',
            '\\': 'Backslash',
            ';': 'Semicolon',
            "'": 'Quote',
            ',': 'Comma',
            '.': 'Period',
            '/': 'Slash'
        };

        return specialKeys[key] || null;
    }

    /**
     * 检查是否是完整的快捷键组合
     */
    isCompleteShortcut(event) {
        const key = this.normalizeKey(event);

        // 单独的修饰键不算完整快捷键
        if (['Ctrl', 'Alt', 'Shift', 'Cmd'].includes(key)) {
            return false;
        }

        // 特殊键可以单独作为快捷键
        const specialKeys = ['Space', 'Escape', 'Enter', 'Tab', 'F11', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F12'];
        if (specialKeys.includes(key)) {
            return true;
        }

        // 字母、数字、方向键需要配合修饰键
        if (/^[A-Z0-9]$/.test(key) || key.startsWith('Arrow')) {
            return event.ctrlKey || event.altKey || event.metaKey;
        }

        return false;
    }

    /**
     * 生成快捷键字符串
     */
    generateShortcutString() {
        if (this.pressedKeys.size === 0) return '';

        const keys = Array.from(this.pressedKeys);
        const modifiers = [];
        const mainKeys = [];

        // 分离修饰键和主键
        keys.forEach(key => {
            if (['Ctrl', 'Alt', 'Shift', 'Cmd'].includes(key)) {
                modifiers.push(key);
            } else {
                mainKeys.push(key);
            }
        });

        // 按固定顺序排列修饰键
        const orderedModifiers = [];
        if (modifiers.includes('Ctrl')) orderedModifiers.push('Ctrl');
        if (modifiers.includes('Alt')) orderedModifiers.push('Alt');
        if (modifiers.includes('Shift')) orderedModifiers.push('Shift');
        if (modifiers.includes('Cmd')) orderedModifiers.push('Cmd');

        // 组合成快捷键字符串
        return [...orderedModifiers, ...mainKeys].join('+');
    }

    /**
     * 验证快捷键字符串格式
     */
    static validateShortcut(shortcutString) {
        if (!shortcutString || typeof shortcutString !== 'string') {
            return {valid: false, error: '快捷键不能为空'};
        }

        const parts = shortcutString.split('+');
        if (parts.length === 0) {
            return {valid: false, error: '无效的快捷键格式'};
        }

        // 检查是否有重复的键
        const uniqueParts = new Set(parts);
        if (uniqueParts.size !== parts.length) {
            return {valid: false, error: '快捷键包含重复的键'};
        }

        // 检查修饰键的顺序
        const modifiers = ['Ctrl', 'Alt', 'Shift', 'Cmd'];
        let lastModifierIndex = -1;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const modifierIndex = modifiers.indexOf(part);

            if (modifierIndex !== -1) {
                if (modifierIndex <= lastModifierIndex) {
                    return {valid: false, error: '修饰键顺序不正确'};
                }
                lastModifierIndex = modifierIndex;
            } else {
                return {valid: false, error: `无效的修饰键: ${part}`};
            }
        }

        return {valid: true};
    }

    /**
     * 格式化快捷键显示
     */
    static formatShortcut(shortcutString) {
        if (!shortcutString) return '';

        return shortcutString
            .replace(/Ctrl/g, 'Ctrl')
            .replace(/Alt/g, 'Alt')
            .replace(/Shift/g, 'Shift')
            .replace(/Cmd/g, '⌘')
            .replace(/ArrowUp/g, '↑')
            .replace(/ArrowDown/g, '↓')
            .replace(/ArrowLeft/g, '←')
            .replace(/ArrowRight/g, '→')
            .replace(/Space/g, '空格');
    }
}

let shortcutRecorder = new ShortcutRecorder();
export {shortcutRecorder};
