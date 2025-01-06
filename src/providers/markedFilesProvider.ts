import * as vscode from 'vscode';
import { getBasename, getDirname } from '../utils/fileUtils';

export const markedFiles = new Set<string>();

export class MarkedFilesProvider
	implements vscode.TreeDataProvider<vscode.TreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<
		vscode.TreeItem | undefined | null | void
	> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		vscode.TreeItem | undefined | null | void
	> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			return Promise.resolve(
				Array.from(markedFiles).map((filePath) => {
					const treeItem = new vscode.TreeItem(getBasename(filePath));
					treeItem.description = getDirname(filePath);
					treeItem.command = {
						command: 'vscode.open',
						title: 'Open Marked File',
						arguments: [vscode.Uri.file(filePath)],
					};
					treeItem.contextValue = 'markedFile';
					treeItem.resourceUri = vscode.Uri.file(filePath);
					return treeItem;
				}),
			);
		}
	}
}
