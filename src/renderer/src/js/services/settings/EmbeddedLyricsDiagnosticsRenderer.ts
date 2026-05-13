export interface EmbeddedLyricsDiagnosticsElements {
    testButton: HTMLButtonElement | null;
}

type EmbeddedLyricsDiagnosticsState = 'idle' | 'selecting' | 'checking';

class EmbeddedLyricsDiagnosticsRenderer {
    setState(elements: EmbeddedLyricsDiagnosticsElements, state: EmbeddedLyricsDiagnosticsState): void {
        const button = elements.testButton;
        if (!button) {
            return;
        }

        switch (state) {
            case 'selecting':
                button.disabled = true;
                button.textContent = '选择文件...';
                break;
            case 'checking':
                button.disabled = true;
                button.textContent = '检测中...';
                break;
            case 'idle':
                button.disabled = false;
                button.textContent = '测试内嵌歌词';
                break;
        }
    }
}

export const embeddedLyricsDiagnosticsRenderer = new EmbeddedLyricsDiagnosticsRenderer();
