export function extractImports(content: string): string[] {
    const regex =
        /import\s+(?:[a-zA-Z0-9_{}\s*]*\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        const importPath = match[1] ?? match[2];
        if (importPath) {
            imports.push(importPath);
        }
    }

    return imports;
};