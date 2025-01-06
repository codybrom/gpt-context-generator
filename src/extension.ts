import * as vscode from 'vscode';
import { MarkedFilesProvider } from './providers/markedFilesProvider';
import { CommandHandler } from './commandHandler';

export function activate(context: vscode.ExtensionContext) {
	const markedFilesProvider = new MarkedFilesProvider();
	const commandHandler = new CommandHandler(markedFilesProvider);

	vscode.window.registerTreeDataProvider(
		'markedFilesView',
		markedFilesProvider,
	);

	// Register all commands
	const disposables = [
		vscode.commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContext',
			() => commandHandler.createGPTFriendlyContext(),
		),

		vscode.commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContextForOpenFile',
			() => commandHandler.createGPTFriendlyContextForOpenFile(),
		),

		vscode.commands.registerCommand(
			'gpt-context-generator.markFileForInclusion',
			() => commandHandler.markFileForInclusion(),
		),

		vscode.commands.registerCommand(
			'gpt-context-generator.createGPTFriendlyContextForMarkedFiles',
			() => commandHandler.createGPTFriendlyContextForMarkedFiles(),
		),

		vscode.commands.registerCommand(
			'gpt-context-generator.clearMarkedFiles',
			() => commandHandler.clearMarkedFiles(),
		),

		vscode.commands.registerCommand(
			'gpt-context-generator.unmarkFileFromTreeView',
			(treeItem: vscode.TreeItem) =>
				commandHandler.unmarkFileFromTreeView(treeItem),
		),
	];

	// Add all disposables to subscriptions
	context.subscriptions.push(...disposables);
}

export function deactivate() {}
