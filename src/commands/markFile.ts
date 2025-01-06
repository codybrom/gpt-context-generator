import { TreeItem } from 'vscode';
import { markedFiles } from '../providers/markedFilesProvider';
import type { MarkedFilesProvider } from '../providers/markedFilesProvider';
import { getActiveFilePath, showMessage } from '../utils/vscodeUtils';

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
};
