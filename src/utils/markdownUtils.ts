export function getMarkdownLang(fileExtension: string): string {
	switch (fileExtension) {
		case 'js':
			return 'javascript';
		case 'ts':
			return 'typescript';
		case 'md':
			return 'markdown';
		default:
			return fileExtension;
	}
}

export function formatFileComment(
	format: string,
	filePath: string,
	fileExtension: string,
	fileContent: string,
): string {
	return format
		.replace(/\\n/g, '\n')
		.replace('{filePath}', filePath)
		.replace('{markdownLang}', getMarkdownLang(fileExtension))
		.replace('{fileContent}', fileContent);
}