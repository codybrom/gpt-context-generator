const IMPORT_PATTERN =
	/import\s+(?:[a-zA-Z0-9_{}\s*]*\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;

export function extractImports(content: string): string[] {
	return Array.from(
		content.matchAll(IMPORT_PATTERN),
		(match) => match[1] ?? match[2],
	).filter(Boolean);
}
