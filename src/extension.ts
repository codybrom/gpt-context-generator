import { MarkedFilesProvider } from './providers/markedFilesProvider';
import { createContext } from './commands/createContext';
import { markFile } from './commands/markFile';
import { clearMarkedFiles } from './commands/clearMarkedFiles';
import { commands, ExtensionContext, TreeItem, Uri, window } from 'vscode';

export function activate(context: ExtensionContext) {
	const markedFilesProvider = new MarkedFilesProvider();

	window.registerTreeDataProvider('markedFilesView', markedFilesProvider);

	// Register all commands
	const disposables = [
		commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContext',
			() => createContext.forWorkspace(),
		),

		commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContextForOpenFile',
			() => createContext.forOpenFile(),
		),

		commands.registerCommand('gpt-context-generator.markFileForInclusion', () =>
			markFile.toggleMark(markedFilesProvider),
		),

		commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContextForMarkedFiles',
			() => createContext.forMarkedFiles(),
		),

		commands.registerCommand('gpt-context-generator.clearMarkedFiles', () =>
			clearMarkedFiles(markedFilesProvider),
		),

		commands.registerCommand(
			'gpt-context-generator.unmarkFileFromTreeView',
			(treeItem: TreeItem) =>
				markFile.unmarkFromTreeView(treeItem, markedFilesProvider),
		),

		commands.registerCommand(
			'gpt-context-generator.markFilesFromExplorer',
			(uri: Uri, uris: Uri[]) => {
				// If multiple files are selected, use those
				const selectedUris = uris?.length ? uris : [uri];
				markFile.markMultiple(selectedUris, markedFilesProvider);
			},
		),

		commands.registerCommand(
			'gpt-context-generator.markFolderFromExplorer',
			(uri: Uri) => markFile.markFolder(uri, markedFilesProvider),
		),
		markedFilesProvider,
	];

	// Add all disposables to subscriptions
	context.subscriptions.push(...disposables);
}

export function deactivate() {}
