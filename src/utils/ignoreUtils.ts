import ignore, { Ignore } from 'ignore';
import { fileExists, readFileContent, resolvePath } from './fileUtils';
import { getConfig } from './vscodeUtils';

class IgnoreManager {
	private filter: Ignore;

	constructor() {
		this.filter = ignore();
	}

	initialize(workspacePath: string): void {
		const ignoreFiles = getConfig().ignoreFiles;
		this.filter = ignore();

		// Process each ignore file
		for (const ignoreFile of ignoreFiles) {
			const ignorePath = resolvePath(workspacePath, ignoreFile);
			const ignoreContent = fileExists(ignorePath)
				? readFileContent(ignorePath)
				: null;

			if (ignoreContent) {
				this.filter.add(ignoreContent);
			}
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
