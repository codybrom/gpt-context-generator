import { window, workspace } from 'vscode';

export const validateWorkspace = (): string | null => {
	if (!workspace.workspaceFolders) {
		showMessage.error('Please open a workspace to use this extension.');
		return null;
	}
	return workspace.workspaceFolders[0].uri.fsPath;
};

export const getActiveFilePath = (): string | null => {
	if (!window.activeTextEditor) {
		showMessage.error('Please open a file to use this feature.');
		return null;
	}
	return window.activeTextEditor.document.uri.fsPath;
};

export const showMessage = {
	info: (message: string) => window.showInformationMessage(message),
	error: (message: string) => window.showErrorMessage(message),
	warning: (message: string) => window.showWarningMessage(message),
	copySuccess: () => showMessage.info('LLM-ready context copied to clipboard.'),
	tokenCount: (count: number) => {
		const message = `The generated context is approximately ${count} tokens${
			count > 8000 ? ', which is greater than 8000 tokens' : ''
		}.`;
		if (count > 8000) {
			showMessage.warning(message);
		} else {
			showMessage.info(message);
		}
	},
};
