import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignoreFactory = require('ignore');
import {encode} from 'gpt-3-encoder';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'gpt-context-generator.createGPTFriendlyContext',
    async () => {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Please open a workspace to use this extension.');
        return;
      }
      const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const config = vscode.workspace.getConfiguration('gpt-context-generator');
      const includePackageJson = (config.get('includePackageJson') as boolean) ?? false;
      await handleCommand(workspacePath, {includePackageJson});
    }
  );

  let disposableOpenFile = vscode.commands.registerCommand(
    'gpt-context-generator.createGPTFriendlyContextForOpenFile',
    async () => {
      if (!vscode.workspace.workspaceFolders || !vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage('Please open a workspace and a file to use this extension.');
        return;
      }
      const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const openFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
      const config = vscode.workspace.getConfiguration('gpt-context-generator');
      const includePackageJson = (config.get('includePackageJson') as boolean) ?? false;
      await handleCommand(workspacePath, {openFilePath, includePackageJson});
    }
  );

  context.subscriptions.push(disposableOpenFile);
  context.subscriptions.push(disposable);
}

async function handleCommand(
  workspacePath: string,
  options: {
    openFilePath?: string;
    includePackageJson?: boolean;
  }
) {
  const config = vscode.workspace.getConfiguration('gpt-context-generator');
  const outputMethod = config.get('outputMethod') as string;

  const gptContext = options.openFilePath
    ? await createGPTFriendlyContextForOpenFile(
        workspacePath,
        options.openFilePath,
        options.includePackageJson ?? false
      )
    : await createGPTFriendlyContext(workspacePath, options.includePackageJson ?? false);

  if (outputMethod === 'newWindow') {
    const gptContextDocument = await vscode.workspace.openTextDocument({
      content: gptContext,
      language: 'plaintext',
    });

    await vscode.window.showTextDocument(gptContextDocument, vscode.ViewColumn.One);
  } else if (outputMethod === 'clipboard') {
    await vscode.env.clipboard.writeText(gptContext);
    vscode.window.showInformationMessage('GPT-friendly context copied to clipboard.');
  }

  const tokenCount = estimateTokenCount(gptContext);
  if (tokenCount > 8000) {
    vscode.window.showWarningMessage(
      `The generated context is approximately ${tokenCount} tokens, which is greater than 8000 tokens.`
    );
  } else {
    vscode.window.showInformationMessage(
      `The generated context is approximately ${tokenCount} tokens.`
    );
  }
}

async function createGPTFriendlyContext(
  workspacePath: string,
  includePackageJson: boolean
): Promise<string> {
  const gitIgnorePath = path.join(workspacePath, '.gitignore');
  const ignoreFilter = ignoreFactory();

  if (fs.existsSync(gitIgnorePath)) {
    const gitIgnoreContent = fs.readFileSync(gitIgnorePath).toString();
    ignoreFilter.add(gitIgnoreContent);
  }

  const gptContext: string[] = [];
  const config = vscode.workspace.getConfiguration('gpt-context-generator');
  const detectedFileExtensions = config.get('detectedFileExtensions') as string[];

  const processDirectory = async (dir: string) => {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const relFilePath = path.relative(workspacePath, filePath);

      if (ignoreFilter.ignores(relFilePath)) {
        continue;
      }

      const fileStat = fs.lstatSync(filePath);

      if (fileStat.isDirectory()) {
        await processDirectory(filePath);
      } else if (fileStat.isFile()) {
        const fileExtension = path.extname(filePath).toLowerCase().substring(1);

        if (detectedFileExtensions.includes(fileExtension)) {
          const fileContent = fs.readFileSync(filePath).toString();
          gptContext.push(`File: ${relFilePath}\n\n${fileContent}\n\n`);
        }
      }
    }
  };

  await processDirectory(workspacePath);
  return gptContext.join('\n');
}

async function createGPTFriendlyContextForOpenFile(
  workspacePath: string,
  openFilePath: string,
  includePackageJson: boolean
): Promise<string> {
  const gitIgnorePath = path.join(workspacePath, '.gitignore');
  const ignoreFilter = ignoreFactory();

  if (fs.existsSync(gitIgnorePath)) {
    const gitIgnoreContent = fs.readFileSync(gitIgnorePath).toString();
    ignoreFilter.add(gitIgnoreContent);
  }

  const gptContext: string[] = [];
  const config = vscode.workspace.getConfiguration('gpt-context-generator');
  const detectedFileExtensions = config.get('detectedFileExtensions') as string[];

  const openFileContent = fs.readFileSync(openFilePath).toString();
  const openFileRelPath = path.relative(workspacePath, openFilePath);
  const openFileExtension = path.extname(openFilePath).toLowerCase().substring(1);

  if (detectedFileExtensions.includes(openFileExtension)) {
    gptContext.push(`File: ${openFileRelPath}\n\n${openFileContent}\n\n`);
  }

  const extractImports = (content: string): string[] => {
    const regex = /import\s+.*\s+from\s+['"](.*)['"];/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  };

  const imports = extractImports(openFileContent);
  for (const importPath of imports) {
    const importFileExtension = path.extname(importPath).toLowerCase().substring(1);

    if (detectedFileExtensions.includes(importFileExtension)) {
      const absoluteImportPath = path.resolve(path.dirname(openFilePath), importPath);
      const relImportPath = path.relative(workspacePath, absoluteImportPath);

      if (!ignoreFilter.ignores(relImportPath) && fs.existsSync(absoluteImportPath)) {
        const importedFileContent = fs.readFileSync(absoluteImportPath).toString();
        gptContext.push(`File: ${relImportPath}\n\n${importedFileContent}\n\n`);
      }
    }
  }

  if (includePackageJson) {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = fs.readFileSync(packageJsonPath).toString();
      gptContext.push(`File: package.json\n\n${packageJsonContent}\n\n`);
    }
  }

  return gptContext.join('\n');
}

function estimateTokenCount(text: string): number {
  const encoded = encode(text);
  return encoded.length;
}

export function deactivate() {}
