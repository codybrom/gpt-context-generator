import { initializeTokenUtils } from './utils/tokenUtils';
import { MarkedFilesProvider } from './providers/markedFilesProvider';
import { createContext } from './commands/createContext';
import { markFile } from './commands/markFile';
import { clearMarkedFiles } from './commands/clearMarkedFiles';
import { commands, ExtensionContext, TreeItem, Uri, window } from 'vscode';
import { initializeIgnoreFilter } from './utils/ignoreUtils';
import { validateWorkspace } from './utils/vscodeUtils';

export function activate(context: ExtensionContext) {
	const workspacePath = validateWorkspace();
	if (workspacePath) {
		initializeIgnoreFilter(workspacePath);
	}

	initializeTokenUtils(context);

	const markedFilesProvider = new MarkedFilesProvider();
	const treeView = window.createTreeView('markedFilesView', {
		treeDataProvider: markedFilesProvider,
		showCollapseAll: true,
	});

	// Update the view title with token count
	context.subscriptions.push(
		markedFilesProvider.onDidChangeTreeData(() => {
			treeView.title = `Marked for LLM Context (${markedFilesProvider.getTokenCountDisplay()})`;
		}),
	);

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
				// If multiple items are selected, use those
				const selectedUris = uris?.length ? uris : [uri];
				markFile.markItems(selectedUris, markedFilesProvider);
			},
		),
		markedFilesProvider,
	];

	// Add all disposables to subscriptions
	context.subscriptions.push(...disposables);
}

export function deactivate() {}
