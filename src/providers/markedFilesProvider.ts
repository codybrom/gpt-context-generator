import {
	Event,
	EventEmitter,
	TreeDataProvider,
	TreeItem,
	Uri,
	workspace,
	RelativePattern,
	FileSystemWatcher,
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
	private fileWatcher: FileSystemWatcher | undefined;

	constructor() {
		this.initializeFileWatcher();
	}

	private initializeFileWatcher(): void {
		if (!workspace.workspaceFolders) {
			return;
		}

		// Watch all files in the workspace
		const pattern = new RelativePattern(workspace.workspaceFolders[0], '**/*');
		this.fileWatcher = workspace.createFileSystemWatcher(pattern);

		// Handle file deletion
		this.fileWatcher.onDidDelete((uri) => {
			if (markedFiles.has(uri.fsPath)) {
				markedFiles.delete(uri.fsPath);
				this.refresh();
				showMessage.info(
					`Removed deleted file from marked files: ${getBasename(uri.fsPath)}`,
				);
			}
		});

		// Handle file renaming/moving using workspace.onDidRenameFiles
		workspace.onDidRenameFiles(({ files }) => {
			files.forEach(({ oldUri, newUri }) => {
				if (markedFiles.has(oldUri.fsPath)) {
					markedFiles.delete(oldUri.fsPath);
					markedFiles.add(newUri.fsPath);
					this.refresh();
					showMessage.info(
						`Updated marked file path: ${getBasename(oldUri.fsPath)} → ${getBasename(newUri.fsPath)}`,
					);
				}
			});
		});
	}

	dispose(): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
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
