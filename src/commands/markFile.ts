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
		if (treeItem && treeItem.resourceUri) {
			const filePath = treeItem.resourceUri.fsPath;
			if (markedFiles.has(filePath)) {
				this.unmarkFile(filePath, markedFilesProvider);
			}
		} else {
			showMessage.error('Unable to unmark file from the tree view.');
		}
	},

	async markItems(uris: Uri[], markedFilesProvider: MarkedFilesProvider) {
		const newFiles: string[] = [];

		for (const uri of uris) {
			if (isDirectory(uri.fsPath)) {
				// Process directory
				await this.processDirectory(uri.fsPath, newFiles);
			} else {
				// Process single file
				if (!markedFiles.has(uri.fsPath)) {
					newFiles.push(uri.fsPath);
				}
			}
		}

		if (newFiles.length === 0) {
			showMessage.info('Selected items are already marked.');
			return;
		}

		this.updateMarkedFiles(
			() => newFiles.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${newFiles.length} file(s) for inclusion`,
			markedFilesProvider,
		);
	},

	async processDirectory(dir: string, newFiles: string[]) {
		const files = listFiles(dir);

		for (const file of files) {
			const filePath = resolvePath(dir, file);
			const relPath = getRelativePath(
				workspace.workspaceFolders![0].uri.fsPath,
				filePath,
			);

			if (isIgnored(relPath)) {
				continue;
			}

			if (isDirectory(filePath)) {
				await this.processDirectory(filePath, newFiles);
			} else if (!markedFiles.has(filePath)) {
				newFiles.push(filePath);
			}
		}
	},
};
