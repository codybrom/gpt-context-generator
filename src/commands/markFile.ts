import { TreeItem, Uri, workspace } from 'vscode';
import { markedFiles } from '../providers/markedFilesProvider';
import type { MarkedFilesProvider } from '../providers/markedFilesProvider';
import {
	getActiveFilePath,
	getConfig,
	showMessage,
	validateWorkspace,
} from '../utils/vscodeUtils';
import {
	getBasename,
	getDirname,
	getExtension,
	getRelativePath,
	isDirectory,
	listFiles,
	resolvePath,
} from '../utils/fileUtils';
import { isIgnored } from '../utils/ignoreUtils';

export const markFile = {
	async updateMarkedFiles(
		action: () => void,
		message: string,
		markedFilesProvider: MarkedFilesProvider,
	) {
		action();
		showMessage.info(message);
		await markedFilesProvider.refresh();
	},

	unmarkFile(filePath: string, markedFilesProvider: MarkedFilesProvider) {
		this.updateMarkedFiles(
			() => markedFiles.delete(filePath),
			`Unmarked: ${getBasename(filePath)}`,
			markedFilesProvider,
		);
	},

	isFileTypeSupported(filePath: string): boolean {
		const extension = getExtension(filePath);
		const supportedExtensions = getConfig().detectedFileExtensions;
		return supportedExtensions.includes(extension);
	},

	async toggleMark(markedFilesProvider: MarkedFilesProvider) {
		const filePath = getActiveFilePath();
		if (!filePath) {
			return;
		}

		const workspacePath = validateWorkspace();
		if (!workspacePath) {
			showMessage.error(
				'No workspace folder found\nPlease open a workspace or folder to use this feature',
			);
			return;
		}

		const relPath = getRelativePath(workspacePath, filePath);
		if (isIgnored(relPath)) {
			showMessage.warning(
				`Cannot mark "${getBasename(filePath)}": File is excluded\nThis file matches patterns in your ignore files (.gitignore, .dockerignore, etc.)\nPath: ${relPath}`,
			);
			return;
		}

		if (!this.isFileTypeSupported(filePath)) {
			showMessage.warning(
				`Cannot mark "${getBasename(filePath)}": Unsupported file type (.${getExtension(filePath)})\nSupported types: ${getConfig().detectedFileExtensions.join(', ')}\nYou can add more file types in Settings > LLM Context Generator > Detected File Extensions`,
			);
			return;
		}

		if (markedFiles.has(filePath)) {
			this.unmarkFile(filePath, markedFilesProvider);
		} else {
			this.updateMarkedFiles(
				() => markedFiles.add(filePath),
				`Marked: ${getBasename(filePath)}`,
				markedFilesProvider,
			);
		}
	},

	async unmarkFromTreeView(
		treeItem: TreeItem,
		markedFilesProvider: MarkedFilesProvider,
	) {
		if (!treeItem?.resourceUri?.fsPath) {
			showMessage.error(
				'Unable to unmark file\nThe selected item is not a valid file or is no longer available',
			);
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
			showMessage.error(
				'No workspace folder found\nPlease open a workspace or folder to use this feature',
			);
			return;
		}

		const newFiles = new Set<string>();
		const ignoredFiles = new Set<string>();
		const unsupportedFiles = new Set<string>();

		await Promise.all(
			uris.map(async (uri) => {
				const filePath = uri.fsPath;
				if (!isDirectory(filePath)) {
					const relPath = getRelativePath(workspacePath, filePath);
					if (isIgnored(relPath)) {
						ignoredFiles.add(filePath);
						return;
					}
					if (!this.isFileTypeSupported(filePath)) {
						unsupportedFiles.add(filePath);
						return;
					}
				}
				await this.processPath(filePath, newFiles, workspacePath);
			}),
		);

		if (ignoredFiles.size > 0) {
			const ignoreFiles = getConfig().ignoreFiles;
			showMessage.warning(
				`Skipped ${ignoredFiles.size} file(s) matching patterns in ignore files (${ignoreFiles.join(', ')}):\n${Array.from(
					ignoredFiles,
				)
					.map((file) => `• ${getBasename(file)} (${getDirname(file)})`)
					.join('\n')}`,
			);
		}

		if (unsupportedFiles.size > 0) {
			showMessage.warning(
				`Skipped ${unsupportedFiles.size} unsupported file(s):\n${Array.from(
					unsupportedFiles,
				)
					.map((file) => `• ${getBasename(file)} (.${getExtension(file)})`)
					.join(
						'\n',
					)}\nYou can add file types in Settings > LLM Context Generator > Detected File Extensions`,
			);
		}

		if (newFiles.size === 0) {
			if (ignoredFiles.size === 0 && unsupportedFiles.size === 0) {
				showMessage.info('Selected items are already marked.');
			}
			return;
		}

		this.updateMarkedFiles(
			() => newFiles.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${newFiles.size} file(s)`,
			markedFilesProvider,
		);
	},

	async processPath(
		path: string,
		newFiles: Set<string>,
		workspacePath: string,
	): Promise<void> {
		if (!isDirectory(path)) {
			const relPath = getRelativePath(workspacePath, path);
			if (isIgnored(relPath)) {
				return; // Skip warning as it's handled at higher level
			}
			if (!this.isFileTypeSupported(path)) {
				return; // Skip warning as it's handled at higher level
			}
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
			showMessage.error(
				`Failed to process directory "${getBasename(path)}"\n${error instanceof Error ? error.message : 'Unknown error'}\nPlease check folder permissions and try again`,
			);
		}
	},
};
