import {
	Event,
	EventEmitter,
	TreeDataProvider,
	TreeItem,
	Uri,
	workspace,
} from 'vscode';
import { getBasename, getDirname } from '../utils/fileUtils';
import { showMessage } from '../utils/vscodeUtils';

export const markedFiles = new Set<string>();

export class MarkedFilesProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<
		TreeItem | undefined | null | void
	> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;
	private disposables: { dispose(): void }[] = [];

	constructor() {
		this.initializeFileWatchers();
	}

	private initializeFileWatchers(): void {
		if (!workspace.workspaceFolders) {
			return;
		}

		// Handle file deletions at workspace level
		this.disposables.push(
			workspace.onDidDeleteFiles(({ files }) => {
				let deletedCount = 0;
				files.forEach((uri) => {
					if (markedFiles.has(uri.fsPath)) {
						markedFiles.delete(uri.fsPath);
						deletedCount++;
					}
				});

				if (deletedCount > 0) {
					this.refresh();
					showMessage.info(
						`Removed ${deletedCount} deleted file${deletedCount === 1 ? '' : 's'} from marked files`,
					);
				}
			}),
		);

		// Handle file renaming/moving at workspace level
		this.disposables.push(
			workspace.onDidRenameFiles(({ files }) => {
				let renamedCount = 0;
				files.forEach(({ oldUri, newUri }) => {
					if (markedFiles.has(oldUri.fsPath)) {
						markedFiles.delete(oldUri.fsPath);
						markedFiles.add(newUri.fsPath);
						renamedCount++;
					}
				});

				if (renamedCount > 0) {
					this.refresh();
					showMessage.info(
						`Updated ${renamedCount} marked file path${renamedCount === 1 ? '' : 's'}`,
					);
				}
			}),
		);
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables = [];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			return Promise.resolve(
				Array.from(markedFiles).map((filePath) => {
					const treeItem = new TreeItem(getBasename(filePath));
					treeItem.description = getDirname(filePath);
					treeItem.command = {
						command: 'vscode.open',
						title: 'Open Marked File',
						arguments: [Uri.file(filePath)],
					};
					treeItem.contextValue = 'markedFile';
					treeItem.resourceUri = Uri.file(filePath);
					return treeItem;
				}),
			);
		}
	}
}
