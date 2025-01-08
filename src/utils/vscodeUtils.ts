import { window, workspace } from 'vscode';

export const getActiveFilePath = (): string | null => {
	if (!window.activeTextEditor) {
		showMessage.error('Please open a file to use this feature.');
		return null;
	}
	return window.activeTextEditor.document.uri.fsPath;
};

export const getConfig = () => {
	const config = workspace.getConfiguration('gpt-context-generator');
	return {
		tokenWarningThreshold: config.get('tokenWarningThreshold') as number,
		includePackageJson: (config.get('includePackageJson') as boolean) ?? false,
		outputMethod: config.get('outputMethod') as string,
		outputLanguage: config.get('outputLanguage') as string,
		detectedFileExtensions: config.get('detectedFileExtensions') as string[],
		ignoreFiles: config.get('ignoreFiles') as string[],
		enforceFileTypes: (config.get('enforceFileTypes') as boolean) ?? true,
	};
};

export const showMessage = {
	info: (message: string) => window.showInformationMessage(message),
	error: (message: string) => window.showErrorMessage(message),
	warning: (message: string) => window.showWarningMessage(message),
	copySuccess: () => showMessage.info('LLM-ready context copied to clipboard.'),
	tokenCount: (count: number) => {
		const threshold = getConfig().tokenWarningThreshold;
		const message = `The generated context is approximately ${count} tokens${
			count > threshold ? `, which is greater than ${threshold} tokens` : ''
		}.`;
		if (count > threshold) {
			showMessage.warning(message);
		} else {
			showMessage.info(message);
		}
	},
};

export const validateWorkspace = (): string | null => {
	if (!workspace.workspaceFolders) {
		showMessage.error('Please open a workspace to use this extension.');
		return null;
	}
	return workspace.workspaceFolders[0].uri.fsPath;
};
