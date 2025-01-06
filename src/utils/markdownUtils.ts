import hljs from 'highlight.js';

export const getMarkdownLang = (extension: string): string => {
	// Remove the dot if present
	const ext = extension.replace(/^\./, '');

	// Try to get the language from highlight.js
	const language = hljs.getLanguage(ext);

	// If found, return the name, otherwise fallback to the extension
	return language?.name ?? ext;
};

export const formatFileComment = (format: string, file: FileData): string => {
	const replacements = {
		filePath: file.path,
		markdownLang: getMarkdownLang(file.extension),
		fileContent: file.content,
	};

	return format
		.replace(/\\n/g, '\n')
		.replace(
			/{(\w+)}/g,
			(_, key) => replacements[key as keyof typeof replacements] ?? '',
		);
};
