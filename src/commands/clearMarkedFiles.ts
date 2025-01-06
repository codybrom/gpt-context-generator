import { markedFiles } from '../providers/markedFilesProvider';
import { showMessage } from '../utils/vscodeUtils';
import type { MarkedFilesProvider } from '../providers/markedFilesProvider';

export const clearMarkedFiles = async (
	markedFilesProvider: MarkedFilesProvider,
) => {
	markedFiles.clear();
	markedFilesProvider.refresh();
	showMessage.info('Cleared all marked files.');
};
