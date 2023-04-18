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
          const fileComment = `// --- END OF FILE: ${relFilePath} ---\n\n// --- START OF FILE: ${relFilePath} ---\n`;
          gptContext.push(`${fileComment}${fileContent}\n\n`);
        }
      }
    }
  };

  await processDirectory(workspacePath);
  return gptContext.join('\n');
}

const extractImports = (content: string): string[] => {
  const regex =
    /import\s+(?:[a-zA-Z0-9_{}\s*]*\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1] ?? match[2];
    if (importPath) {
      imports.push(importPath);
    }
  }

  return imports;
};

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
    const fileStartComment = `// --- START FILE: ${openFileRelPath} ---\n`;
    const fileEndComment = `\n// --- END FILE: ${openFileRelPath} ---`;
    gptContext.push(`${fileStartComment}${openFileContent}${fileEndComment}\n\n`);
  }

  const imports = extractImports(openFileContent);
  for (const importPath of imports) {
    const resolvedImportPath = path.resolve(path.dirname(openFilePath), importPath);
    const relImportPath = path.relative(workspacePath, resolvedImportPath);

    if (ignoreFilter.ignores(relImportPath)) {
      continue;
    }

    const importFileExtension = path.extname(resolvedImportPath).toLowerCase().substring(1);

    if (!importFileExtension) {
      // Try adding default file extensions if importPath has no extension
      for (const ext of detectedFileExtensions) {
        const importFilePathWithExt = `${resolvedImportPath}.${ext}`;
        const relImportPathWithExt = path.relative(workspacePath, importFilePathWithExt);

        if (fs.existsSync(importFilePathWithExt)) {
          const importedFileContent = fs.readFileSync(importFilePathWithExt).toString();
          const fileStartComment = `// --- START FILE: ${relImportPathWithExt} ---\n`;
          const fileEndComment = `\n// --- END FILE: ${relImportPathWithExt} ---`;
          gptContext.push(`${fileStartComment}${importedFileContent}${fileEndComment}\n\n`);
          break;
        }
      }
    } else if (
      detectedFileExtensions.includes(importFileExtension) &&
      fs.existsSync(resolvedImportPath)
    ) {
      const importedFileContent = fs.readFileSync(resolvedImportPath).toString();
      const fileStartComment = `// --- START FILE: ${resolvedImportPath} ---\n`;
      const fileEndComment = `\n// --- END FILE: ${resolvedImportPath} ---`;
      gptContext.push(`${fileStartComment}${importedFileContent}${fileEndComment}\n\n`);
    }
  }

  if (includePackageJson) {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = fs.readFileSync(packageJsonPath).toString();
      const fileStartComment = `// --- START FILE: package.json ---\n`;
      const fileEndComment = `\n// --- END FILE: package.json ---`;
      gptContext.push(`${fileStartComment}${packageJsonContent}${fileEndComment}\n\n`);
    }
  }

  return gptContext.join('\n');
}

function estimateTokenCount(text: string): number {
  const encoded = encode(text);
  return encoded.length;
}

export function deactivate() {}
