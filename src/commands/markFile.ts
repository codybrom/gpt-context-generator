import { TreeItem, Uri, workspace } from 'vscode';
import { markedFiles } from '../providers/markedFilesProvider';
import type { MarkedFilesProvider } from '../providers/markedFilesProvider';
import { getActiveFilePath, showMessage } from '../utils/vscodeUtils';
import {
	getRelativePath,
	isDirectory,
	listFiles,
	resolvePath,
} from '../utils/fileUtils';
import { isIgnored } from '../utils/ignoreUtils';

export const markFile = {
	updateMarkedFiles(
		action: () => void,
		message: string,
		markedFilesProvider: MarkedFilesProvider,
	) {
		action();
		showMessage.info(message);
		markedFilesProvider.refresh();
	},

	unmarkFile(filePath: string, markedFilesProvider: MarkedFilesProvider) {
		this.updateMarkedFiles(
			() => markedFiles.delete(filePath),
			`File unmarked: ${filePath}`,
			markedFilesProvider,
		);
	},

	async toggleMark(markedFilesProvider: MarkedFilesProvider) {
		const filePath = getActiveFilePath();
		if (!filePath) {
			return;
		}

		if (markedFiles.has(filePath)) {
			this.unmarkFile(filePath, markedFilesProvider);
		} else {
			this.updateMarkedFiles(
				() => markedFiles.add(filePath),
				`File marked for inclusion: ${filePath}`,
				markedFilesProvider,
			);
		}
	},

	async unmarkFromTreeView(
		treeItem: TreeItem,
		markedFilesProvider: MarkedFilesProvider,
	) {
		if (!treeItem?.resourceUri?.fsPath) {
			showMessage.error('Unable to unmark file from the tree view.');
			return;
		}

		const filePath = treeItem.resourceUri.fsPath;
		if (markedFiles.has(filePath)) {
			this.unmarkFile(filePath, markedFilesProvider);
		}
	},

	async markItems(uris: Uri[], markedFilesProvider: MarkedFilesProvider) {
		const workspacePath = workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspacePath) {
			showMessage.error('No workspace folder found.');
			return;
		}

		const newFiles = new Set<string>();
		await Promise.all(
			uris.map((uri) => this.processPath(uri.fsPath, newFiles, workspacePath)),
		);

		if (newFiles.size === 0) {
			showMessage.info('Selected items are already marked.');
			return;
		}

		this.updateMarkedFiles(
			() => newFiles.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${newFiles.size} file(s) for inclusion`,
			markedFilesProvider,
		);
	},

	async processPath(
		path: string,
		newFiles: Set<string>,
		workspacePath: string,
	): Promise<void> {
		if (!isDirectory(path)) {
			if (!markedFiles.has(path)) {
				newFiles.add(path);
			}
			return;
		}

		try {
			const files = listFiles(path);
			await Promise.all(
				files.map(async (file) => {
					const filePath = resolvePath(path, file);
					const relPath = getRelativePath(workspacePath, filePath);

					if (isIgnored(relPath)) {
						return;
					}

					await this.processPath(filePath, newFiles, workspacePath);
				}),
			);
		} catch (error) {
			console.error(`Error processing directory ${path}:`, error);
			showMessage.error(`Failed to process directory: ${path}`);
		}
	},
};
