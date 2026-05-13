class EmbeddedLyricsDiagnosticsDialogRenderer {
    show(report: string): void {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; border: 1px solid #ccc; border-radius: 8px;
            padding: 20px; max-width: 80%; max-height: 80%; overflow: auto;
            z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: monospace; font-size: 12px; line-height: 1.4;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = 'float: right; margin-bottom: 10px; padding: 5px 10px; color: red';
        closeButton.addEventListener('click', () => dialog.remove());

        const content = document.createElement('pre');
        content.textContent = report;
        content.style.cssText = 'margin: 0; white-space: pre-wrap; word-wrap: break-word;';

        dialog.appendChild(closeButton);
        dialog.appendChild(content);
        document.body.appendChild(dialog);
    }
}

export const embeddedLyricsDiagnosticsDialogRenderer = new EmbeddedLyricsDiagnosticsDialogRenderer();
