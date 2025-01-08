import { createContextGenerator } from '../generators/contextGenerator';
import { markedFiles } from '../providers/markedFilesProvider';
import {
	getActiveFilePath,
	getConfig,
	showMessage,
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
		try {
			const contextGenerator = createContextGenerator(workspacePath);

			const config = getConfig();
			await contextGenerator.handleContextGeneration({
				...options,
				includePackageJson: config.includePackageJson,
				outputMethod: config.outputMethod,
				outputLanguage: config.outputLanguage,
			});
		} catch (error) {
			console.error('Error in generateContext:', error);
			throw error;
		}
	},

	async forWorkspace() {
		const workspacePath = validateWorkspace();
		if (!workspacePath) {
			console.log('No workspace path found');
			showMessage.error('Please open a workspace before generating context.');
			return;
		}

		try {
			await this.generateContext(workspacePath, {
				bypassFileTypeEnforcement: false,
			});
			showMessage.info('Context generation completed successfully');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : 'An unknown error occurred';
			console.error('Workspace context generation failed:', errorMessage);
			showMessage.error(
				`Failed to generate workspace context: ${errorMessage}`,
			);
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
