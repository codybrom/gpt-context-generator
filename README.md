# GPT Context Generator

[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/codybrom.gpt-context-generator)](https://marketplace.visualstudio.com/items?itemName=codybrom.gpt-context-generator)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/codybrom.gpt-context-generator)](https://marketplace.visualstudio.com/items?itemName=codybrom.gpt-context-generator)
[![VS Marketplace Rating](https://badgen.net/vs-marketplace/d/codybrom.gpt-context-generator)](https://marketplace.visualstudio.com/items?itemName=codybrom.gpt-context-generator)

This Visual Studio Code extension helps you generate context for .js/.jsx and .ts/.tsx files, making
it easier to collaborate with AI models like OpenAI's GPT-4. The extension generates context by
pulling in local dependencies such as API pages that are referenced in your code. It also respects
`.gitignore` rules to avoid including unnecessary files.

## Features

- Generate GPT-compatible multi-file context from the currently open file and local imports
- Generate GPT-compatible multi-file context of the entire VS Code workspace
- Generate GPT-compatible multi-file context for marked files
- Mark/Unmark files for inclusion in generated context
- Estimate the number of OpenAI tokens in the generated context

## Usage

### Generate context for the currently open file and its local imports

1. Open a file in Visual Studio Code.
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3. Type `Generate GPT Context (Current File + Imports)` and select the command from the list.
4. The generated context, including dependencies, will be displayed in a new editor tab or copied
    to the clipboard based on your configuration.

### Generate context for the entire workspace

1. Open a workspace in Visual Studio Code.
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3. Type `Generate GPT Context (Workspace)` and select the command from the list.
4. The generated context will be displayed in a new editor tab or copied to the clipboard based on
    your configuration.

### Generate context for marked files

1. Open a file in Visual Studio Code.
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3. Type `Mark/Unmark File for Inclusion` and select the command to mark the file for inclusion.
4. Repeat steps 1-3 for all files you want to include in the context.
5. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
6. Type `Generate GPT Context (Marked Files)` and select the command from the list.
7. The generated context for marked files will be displayed in a new editor tab or copied to the
   clipboard based on your configuration.

## Token Count Estimation

When generating context, the extension will also display an information message with an estimated
number of OpenAI tokens in the generated text. This information can be helpful when working with AI
models that have token limitations.

## Configuration

From settings, you can configure the extension to work as you prefer.

- **Output method**
  - Copy to Clipboard (_default_)
  - New Window
- **Output language** (only applies when 'outputMethod' is set to 'newWindow')
  - Plaintext (_default_)
  - Markdown
- **Include package.json in open-file context** (_default: true_)
- **Set File Extensions to Include in Workspace Context**
  - _defaults: js, jsx, ts, tsx, mdx, json_

## License

This extension is released under the MIT License.
