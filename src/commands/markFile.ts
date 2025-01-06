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

	async markMultiple(uris: Uri[], markedFilesProvider: MarkedFilesProvider) {
		const newFiles = uris
			.map((uri) => uri.fsPath)
			.filter((fsPath) => !markedFiles.has(fsPath));

		if (newFiles.length === 0) {
			showMessage.info('Selected files are already marked.');
			return;
		}

		this.updateMarkedFiles(
			() => newFiles.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${newFiles.length} file(s) for inclusion`,
			markedFilesProvider,
		);
	},
	async markFolder(uri: Uri, markedFilesProvider: MarkedFilesProvider) {
		const folderPath = uri.fsPath;
		const newFiles: string[] = [];

		const processDirectory = async (dir: string, contextParts: string[]) => {
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
					await processDirectory(filePath, contextParts);
				} else if (!markedFiles.has(filePath)) {
					newFiles.push(filePath);
				}
			}
		};

		await processDirectory(folderPath, []);

		if (newFiles.length === 0) {
			showMessage.info('All files in folder are already marked.');
			return;
		}

		this.updateMarkedFiles(
			() => newFiles.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${newFiles.length} file(s) from folder for inclusion`,
			markedFilesProvider,
		);
	},
};
