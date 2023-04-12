# GPT Context Generator

[![Code Style Airbnb](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

This Visual Studio Code extension helps you generate context for .js/.jsx and .ts/.tsx files, making
it easier to collaborate with AI models like OpenAI's GPT-4. The extension generates context by
pulling in non-CSS dependencies such as API pages that are referenced in your code. It also respects
`.gitignore` rules to avoid including unnecessary files.

## Features

- Generate context for the entire workspace
- Generate context for the currently open file and its dependencies
- Estimate the number of OpenAI tokens in the generated context

## Usage

### Generate context for the entire workspace

1.  Open a workspace in Visual Studio Code.
2.  Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3.  Type `Generate GPT Friendly Context` and select the command from the list.
4.  The generated context will be displayed in a new editor tab.

### Generate context for the currently open file and its dependencies

1.  Open a file in Visual Studio Code.
2.  Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette.
3.  Type `Generate GPT Friendly Context for Open File` and select the command from the list.
4.  The generated context, including dependencies, will be displayed in a new editor tab.

## Token Count Estimation

When generating context, the extension will also display an information message with an estimated
number of OpenAI tokens in the generated text. This information can be helpful when working with AI
models that have token limitations.

## License

This extension is released under the MIT License.
