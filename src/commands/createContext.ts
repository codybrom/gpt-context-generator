import { workspace } from 'vscode';
import { createContextGenerator } from '../generators/contextGenerator';
import { markedFiles } from '../providers/markedFilesProvider';
import { getActiveFilePath, validateWorkspace } from '../utils/vscodeUtils';

export const createContext = {
	getConfig() {
		const config = workspace.getConfiguration('gpt-context-generator');
		return {
			includePackageJson:
				(config.get('includePackageJson') as boolean) ?? false,
		};
	},

	async generateContext(
		workspacePath: string,
		options: { openFilePath?: string; markedFiles?: string[] },
	) {
		const contextGenerator = createContextGenerator(workspacePath);
		await contextGenerator.handleContextGeneration({
			...options,
			includePackageJson: this.getConfig().includePackageJson,
		});
	},

	async forWorkspace() {
		const workspacePath = validateWorkspace();
		if (workspacePath) {
			await this.generateContext(workspacePath, {});
		}
	},

	async forOpenFile() {
		const workspacePath = validateWorkspace();
		const openFilePath = workspacePath && getActiveFilePath();
		if (workspacePath && openFilePath) {
			await this.generateContext(workspacePath, { openFilePath });
		}
	},

	async forMarkedFiles() {
		const workspacePath = validateWorkspace();
		if (workspacePath) {
			await this.generateContext(workspacePath, {
				markedFiles: Array.from(markedFiles),
			});
		}
	},
};
