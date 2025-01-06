import ignore from 'ignore';
import { fileExists, readFileContent, resolvePath } from './fileUtils';

class IgnoreManager {
	private static filter: ReturnType<typeof ignore> | null = null;

	static initialize(workspacePath: string): void {
		const gitIgnorePath = resolvePath(workspacePath, '.gitignore');
		const gitIgnoreContent = fileExists(gitIgnorePath)
			? readFileContent(gitIgnorePath)
			: null;

		this.filter = ignore();

		if (gitIgnoreContent) {
			this.filter.add(gitIgnoreContent);
		}
	}

	static isIgnored(filePath: string): boolean {
		return this.filter?.ignores(filePath) ?? false;
	}
}

export const { initialize: initializeIgnoreFilter, isIgnored } = IgnoreManager;
