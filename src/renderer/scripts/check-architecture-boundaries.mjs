import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(rendererRoot, 'src');
const configFiles = [
    path.join(rendererRoot, 'tsconfig.json'),
    path.join(rendererRoot, 'vite.config.js')
];
const legacyCompatibilityRoots = [
    path.join(sourceRoot, 'core'),
    path.join(sourceRoot, 'services')
];
const sandboxRuntimeFile = path.join(sourceRoot, 'extensions/core/sandbox/SandboxFrameRuntime.ts');
const pluginHostCodeRoots = [
    path.join(sourceRoot, 'extensions/core'),
    path.join(sourceRoot, 'extensions/api'),
    path.join(sourceRoot, 'features/extensions'),
    path.join(sourceRoot, 'services/plugins'),
    path.resolve(rendererRoot, '..', 'main/services/extensions'),
    path.resolve(rendererRoot, '..', 'main/controllers/ExtensionsController.ts')
];
const pluginOwnedRoots = [
    path.join(sourceRoot, 'extensions/builtin'),
    path.join(sourceRoot, 'extensions/examples')
];

const scannedExtensions = new Set(['.js', '.ts', '.mjs', '.cjs', '.html']);
const ignoredDirectories = new Set([
    'node_modules',
    'public',
    'dist',
    'coverage'
]);

const forbiddenPatterns = [
    {
        pattern: /from\s+['"](?:@\/core|@core)(?:\/[^'"]*)?['"]/g,
        message: 'Use @/app/* or @/features/* instead of legacy core imports.'
    },
    {
        pattern: /import\s+['"](?:@\/core|@core)(?:\/[^'"]*)?['"]/g,
        message: 'Use @/app/* or @/features/* instead of legacy core side-effect imports.'
    },
    {
        pattern: /from\s+['"](?:@\/services|@services)(?:\/[^'"]*)?['"]/g,
        message: 'Use @/features/*/service or @/infrastructure/electron/* instead of legacy services imports.'
    },
    {
        pattern: /import\s+['"](?:@\/services|@services)(?:\/[^'"]*)?['"]/g,
        message: 'Use @/features/*/service or @/infrastructure/electron/* instead of legacy services side-effect imports.'
    },
    {
        pattern: /src=["']\.\/core\/main\.ts["']/g,
        message: 'HTML entries must use ./app/bootstrap/main.ts; core/main.ts is compatibility only.'
    },
    {
        pattern: /['"]@core(?:\/\*)?['"]\s*:/g,
        message: 'Do not expose the legacy @core alias; import from @/app/* or @/features/*.'
    },
    {
        pattern: /['"]@services(?:\/\*)?['"]\s*:/g,
        message: 'Do not expose the legacy @services alias; import from @/features/*/service or @/infrastructure/electron/*.'
    },
    {
        pattern: /from\s+['"]@js(?:\/[^'"]*)?['"]/g,
        message: 'The renderer source root is now @/*; do not import through the removed @js alias.'
    },
    {
        pattern: /import\s+['"]@js(?:\/[^'"]*)?['"]/g,
        message: 'The renderer source root is now @/*; do not import through the removed @js alias.'
    },
    {
        pattern: /\bglobalThis\.eval\s*\(|\beval\s*\(/g,
        message: 'Do not execute plugin code with eval in the main renderer; use the sandbox extension host.'
    },
    {
        pattern: /document\.createElement\(\s*['"]script['"]\s*\)/g,
        message: 'Do not load extension code by injecting script tags in the renderer; use the sandbox extension host.'
    },
    {
        pattern: /\bwindow\.createExtensionAPI\b/g,
        message: 'Do not expose createExtensionAPI on the main renderer window; plugins receive it only inside the sandbox runtime.'
    },
    {
        pattern: /\bregisterQuickAction\b|\bQuickAction\b|\bquickAction\b/g,
        message: 'Do not add ad-hoc plugin quick actions in the host; expose documented generic contribution protocols instead.'
    },
    {
        pattern: /\bpathToModuleVarName\b|replace\(\s*\/-\(\[a-z\]\)\/g/g,
        message: 'Do not infer plugin module globals from plugin ids; use the manifest module field or generic module discovery.'
    }
];

const pluginSpecificPatterns = createPluginSpecificPatterns();

const violations = [];

for (const filePath of walk(sourceRoot)) {
    checkFile(filePath);
}

for (const filePath of configFiles) {
    checkFile(filePath);
}

for (const root of pluginHostCodeRoots) {
    if (!exists(root)) {
        continue;
    }

    if (statSync(root).isDirectory()) {
        for (const filePath of walk(root)) {
            checkPluginHostFile(filePath);
        }
    } else {
        checkPluginHostFile(root);
    }
}

if (violations.length > 0) {
    console.error('\nArchitecture boundary check failed:\n');
    for (const violation of violations) {
        console.error(`${violation.filePath}:${violation.line}:${violation.column}`);
        console.error(`  ${violation.message}`);
        console.error(`  Found: ${violation.match}\n`);
    }
    process.exit(1);
}

console.log('Architecture boundary check passed.');

function checkFile(filePath) {
    const normalized = normalizePath(filePath);
    const contents = readFileSync(filePath, 'utf8');
    const lineStarts = computeLineStarts(contents);

    if (isLegacyCompatibilityFile(filePath)) {
        checkLegacyCompatibilityFile(normalized, contents);
    }

    for (const {pattern, message} of forbiddenPatterns) {
        if (pattern.source.includes('eval') && path.resolve(filePath) === sandboxRuntimeFile) {
            continue;
        }

        if (pattern.source.includes('window\\.createExtensionAPI') && path.resolve(filePath) === sandboxRuntimeFile) {
            continue;
        }

        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(contents)) !== null) {
            const {line, column} = getLocation(lineStarts, match.index);
            violations.push({
                filePath: normalized,
                line,
                column,
                match: match[0],
                message
            });
        }
    }
}

function checkPluginHostFile(filePath) {
    if (isPluginOwnedFile(filePath)) {
        return;
    }

    const normalized = normalizePath(filePath);
    const contents = readFileSync(filePath, 'utf8');
    const lineStarts = computeLineStarts(contents);

    for (const {pattern, message} of pluginSpecificPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(contents)) !== null) {
            const {line, column} = getLocation(lineStarts, match.index);
            violations.push({
                filePath: normalized,
                line,
                column,
                match: match[0],
                message
            });
        }
    }
}

function checkLegacyCompatibilityFile(filePath, contents) {
    if (!contents.includes('@deprecated')) {
        violations.push({
            filePath,
            line: 1,
            column: 1,
            match: '<missing @deprecated>',
            message: 'Legacy core/services compatibility files must be marked @deprecated.'
        });
    }

    const lines = contents.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        const trimmed = lines[index].trim();
        if (
            trimmed === ''
            || trimmed.startsWith('//')
            || trimmed.startsWith('/*')
            || trimmed.startsWith('*')
            || trimmed.startsWith('*/')
            || trimmed.startsWith('import ')
            || trimmed.startsWith('export ')
        ) {
            continue;
        }

        violations.push({
            filePath,
            line: index + 1,
            column: lines[index].indexOf(trimmed) + 1,
            match: trimmed,
            message: 'Legacy core/services compatibility files may only contain comments and import/export forwarding.'
        });
    }
}

function isLegacyCompatibilityFile(filePath) {
    return legacyCompatibilityRoots.some((root) => {
        const relative = path.relative(root, filePath);
        return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    });
}

function isPluginOwnedFile(filePath) {
    return pluginOwnedRoots.some((root) => isWithin(root, filePath));
}

function isWithin(root, filePath) {
    const relative = path.relative(root, filePath);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function* walk(directory) {
    for (const entry of readdirSync(directory)) {
        if (ignoredDirectories.has(entry)) {
            continue;
        }

        const entryPath = path.join(directory, entry);
        const stats = statSync(entryPath);
        if (stats.isDirectory()) {
            yield* walk(entryPath);
            continue;
        }

        if (stats.isFile() && scannedExtensions.has(path.extname(entryPath))) {
            yield entryPath;
        }
    }
}

function exists(filePath) {
    try {
        statSync(filePath);
        return true;
    } catch {
        return false;
    }
}

function createPluginSpecificPatterns() {
    const identifiers = collectBuiltinPluginIdentifiers();
    return identifiers.map((identifier) => ({
        pattern: new RegExp(escapeRegExp(identifier), 'g'),
        message: `Plugin host/framework code must not hard-code concrete plugin identifier "${identifier}"; keep plugin ids, command prefixes, labels, and behavior in plugin-owned manifests/code or data indexes.`
    }));
}

function collectBuiltinPluginIdentifiers() {
    const identifiers = new Set();
    const builtinRoot = path.join(sourceRoot, 'extensions/builtin');
    const indexPath = path.join(builtinRoot, 'extensions.json');

    if (!existsSync(indexPath)) {
        return [];
    }

    try {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        if (!index || !Array.isArray(index.extensions)) {
            return [];
        }

        for (const entry of index.extensions) {
            const dirName = normalizeBuiltinIndexEntry(entry);
            if (!dirName) {
                continue;
            }

            identifiers.add(dirName);

            const manifestPath = path.join(builtinRoot, dirName, 'manifest.json');
            if (!isWithin(builtinRoot, manifestPath) || !existsSync(manifestPath)) {
                continue;
            }

            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
            addPluginManifestIdentifiers(identifiers, manifest);
        }
    } catch (error) {
        console.warn(`Architecture check could not load built-in plugin identifiers: ${error instanceof Error ? error.message : String(error)}`);
    }

    return Array.from(identifiers)
        .filter((identifier) => typeof identifier === 'string' && identifier.trim().length >= 3)
        .sort((a, b) => b.length - a.length);
}

function normalizeBuiltinIndexEntry(entry) {
    const rawPath = typeof entry === 'string' ? entry : entry && entry.path;
    if (typeof rawPath !== 'string') {
        return null;
    }

    const normalized = rawPath.trim().replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
        return null;
    }

    if (!normalized.split('/').every((part) => /^[a-zA-Z0-9._-]+$/.test(part))) {
        return null;
    }

    return normalized;
}

function addPluginManifestIdentifiers(identifiers, manifest) {
    if (!manifest || typeof manifest !== 'object') {
        return;
    }

    addIdentifier(identifiers, manifest.id);
    addIdentifier(identifiers, manifest.name);

    if (manifest.contributes && typeof manifest.contributes === 'object') {
        addCommandPrefixes(identifiers, manifest.contributes.commands);
        addConfigurationPrefixes(identifiers, manifest.contributes.configuration);
    }
}

function addCommandPrefixes(identifiers, commands) {
    if (!Array.isArray(commands)) {
        return;
    }

    for (const contribution of commands) {
        if (!contribution || typeof contribution.command !== 'string') {
            continue;
        }

        const [prefix] = contribution.command.split('.');
        addIdentifier(identifiers, prefix);
    }
}

function addConfigurationPrefixes(identifiers, configuration) {
    if (!configuration || typeof configuration !== 'object' || !configuration.properties) {
        return;
    }

    for (const key of Object.keys(configuration.properties)) {
        const [prefix] = key.split('.');
        addIdentifier(identifiers, prefix);
    }
}

function addIdentifier(identifiers, value) {
    if (typeof value !== 'string') {
        return;
    }

    const trimmed = value.trim();
    if (trimmed.length >= 3) {
        identifiers.add(trimmed);
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeLineStarts(contents) {
    const starts = [0];
    for (let index = 0; index < contents.length; index++) {
        if (contents.charCodeAt(index) === 10) {
            starts.push(index + 1);
        }
    }
    return starts;
}

function getLocation(lineStarts, index) {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineStarts[mid] <= index) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const lineIndex = Math.max(0, high);
    return {
        line: lineIndex + 1,
        column: index - lineStarts[lineIndex] + 1
    };
}

function normalizePath(filePath) {
    return path.relative(rendererRoot, filePath).replace(/\\/g, '/');
}
