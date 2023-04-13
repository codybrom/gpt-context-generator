# GPT Context Generator

[![Code Style Airbnb](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)
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
- Estimate the number of OpenAI tokens in the generated context

## Usage

### Generate context for the currently open file and its local imports

1.  Open a file in Visual Studio Code.
2.  Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3.  Type `Generate GPT Context (Current File + Imports)` and select the command from the list.
4.  The generated context, including dependencies, will be displayed in a new editor tab.

### Generate context for the entire workspace

1.  Open a workspace in Visual Studio Code.
2.  Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3.  Type `Generate GPT Context (Workspace)` and select the command from the list.
4.  The generated context will be displayed in a new editor tab.

## Token Count Estimation

When generating context, the extension will also display an information message with an estimated
number of OpenAI tokens in the generated text. This information can be helpful when working with AI
models that have token limitations.

## Configuration

From settings, you can configure the extension to work as you prefer.

- **Output method**
  - Copy to Clipboard (_default_)
  - New Window as plaintext
- **Include package.json in context** (_default: true_)
- **Set File Extensions to Include in Context**
  - _defaults: js, jsx, ts, tsx, mdx, json_

## License

This extension is released under the MIT License.
