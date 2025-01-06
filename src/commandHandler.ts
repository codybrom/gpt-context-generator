import * as vscode from 'vscode';
import {
	markedFiles,
	MarkedFilesProvider,
} from './providers/markedFilesProvider';
import { createContextGenerator } from './contextGenerator';

export class CommandHandler {
	constructor(private markedFilesProvider: MarkedFilesProvider) {}

	async createGPTFriendlyContext() {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage(
				'Please open a workspace to use this extension.',
			);
			return;
		}
		const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const config = vscode.workspace.getConfiguration('gpt-context-generator');
		const includePackageJson =
			(config.get('includePackageJson') as boolean) ?? false;

		const contextGenerator = createContextGenerator(workspacePath);
		await contextGenerator.handleContextGeneration({ includePackageJson });
	}

	async createGPTFriendlyContextForOpenFile() {
		if (!vscode.workspace.workspaceFolders || !vscode.window.activeTextEditor) {
			vscode.window.showErrorMessage(
				'Please open a workspace and a file to use this extension.',
			);
			return;
		}
		const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const openFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
		const config = vscode.workspace.getConfiguration('gpt-context-generator');
		const includePackageJson =
			(config.get('includePackageJson') as boolean) ?? false;

		const contextGenerator = createContextGenerator(workspacePath);
		await contextGenerator.handleContextGeneration({
			openFilePath,
			includePackageJson,
		});
	}

	async markFileForInclusion() {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showErrorMessage(
				'Please open a file to mark/unmark it for inclusion.',
			);
			return;
		}
		const filePath = vscode.window.activeTextEditor.document.uri.fsPath;
		if (markedFiles.has(filePath)) {
			markedFiles.delete(filePath);
			vscode.window.showInformationMessage(`File unmarked: ${filePath}`);
		} else {
			markedFiles.add(filePath);
			vscode.window.showInformationMessage(
				`File marked for inclusion: ${filePath}`,
			);
		}

		this.markedFilesProvider.refresh();
	}

	async createGPTFriendlyContextForMarkedFiles() {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage(
				'Please open a workspace to use this extension.',
			);
			return;
		}
		const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const config = vscode.workspace.getConfiguration('gpt-context-generator');
		const includePackageJson =
			(config.get('includePackageJson') as boolean) ?? false;

		const contextGenerator = createContextGenerator(workspacePath);
		await contextGenerator.handleContextGeneration({
			markedFiles: Array.from(markedFiles),
			includePackageJson,
		});
	}

	async clearMarkedFiles() {
		markedFiles.clear();
		this.markedFilesProvider.refresh();
		vscode.window.showInformationMessage('Cleared all marked files.');
	}

	async unmarkFileFromTreeView(treeItem: vscode.TreeItem) {
		if (treeItem && treeItem.resourceUri) {
			const filePath = treeItem.resourceUri.fsPath;
			if (markedFiles.has(filePath)) {
				markedFiles.delete(filePath);
				vscode.window.showInformationMessage(`File unmarked: ${filePath}`);
				this.markedFilesProvider.refresh();
			}
		} else {
			vscode.window.showErrorMessage(
				'Unable to unmark file from the tree view.',
			);
		}
	}
}
