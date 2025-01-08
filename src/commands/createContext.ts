import { createContextGenerator } from '../generators/contextGenerator';
import { markedFiles } from '../providers/markedFilesProvider';
import {
	getActiveFilePath,
	getConfig,
	validateWorkspace,
} from '../utils/vscodeUtils';

export const createContext = {
	async generateContext(
		workspacePath: string,
		options: {
			openFilePath?: string;
			markedFiles?: string[];
			bypassFileTypeEnforcement?: boolean;
		},
	) {
		const contextGenerator = createContextGenerator(workspacePath);
		await contextGenerator.handleContextGeneration({
			...options,
			includePackageJson: getConfig().includePackageJson,
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
			await this.generateContext(workspacePath, {
				openFilePath,
				bypassFileTypeEnforcement: true,
			});
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
