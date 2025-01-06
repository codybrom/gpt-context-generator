import ignore, { Ignore } from 'ignore';
import { fileExists, readFileContent, resolvePath } from './fileUtils';

class IgnoreManager {
	private filter: Ignore;

	constructor() {
		this.filter = ignore();
	}

	initialize(workspacePath: string): void {
		const gitIgnorePath = resolvePath(workspacePath, '.gitignore');
		const gitIgnoreContent = fileExists(gitIgnorePath)
			? readFileContent(gitIgnorePath)
			: null;

		this.filter = ignore();

		if (gitIgnoreContent) {
			this.filter.add(gitIgnoreContent);
		}
	}

	isIgnored(filePath: string): boolean {
		return this.filter.ignores(filePath);
	}
}

// Create a singleton instance
const manager = new IgnoreManager();

export const initializeIgnoreFilter = (workspacePath: string) =>
	manager.initialize(workspacePath);
export const isIgnored = (filePath: string) => manager.isIgnored(filePath);
