import React from "react";
import { FileData, StringThumbnail } from "../types/index.js";
import { createThumbnails } from "../lib/index.js";

export type UseThumbnailsOptions = {
	/** If provided, all filenames will be prefixed with the given string before fetching */
	prefix?: string;
}

/**
 * Given an array of files, creates thumbnails for each file and returns an array of data objects with the thumbnail data included
 *
 * @param files Array of files to create thumbnails for
 * @param options Options for thumbnail creation
 * @returns An array of data objects with the thumbnail data included
 */
export function useThumbnails<T extends FileData>(files: T[], options?: UseThumbnailsOptions): (T & StringThumbnail)[] {
	const [thumbs, setThumbs] = React.useState<(T & StringThumbnail)[]>([])

	React.useEffect(() => {
		if (!files.length) return;

		(async () => {
			const thumbs = await createThumbnails(files, options)
			setThumbs(thumbs);
		})();
	}, [files, options])

	return thumbs;
}
