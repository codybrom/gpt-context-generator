import { Event, EventEmitter, TreeDataProvider, TreeItem, Uri } from 'vscode';
import { getBasename, getDirname } from '../utils/fileUtils';

export const markedFiles = new Set<string>();

export class MarkedFilesProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<
		TreeItem | undefined | null | void
	> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

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
