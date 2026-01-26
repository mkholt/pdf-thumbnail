import React from "react";
import { FileData, Thumbnail } from "../types/index.js";
import { createThumbnails } from "../lib/index.js";

/**
 * Given an array of files, creates thumbnails for each file and returns an array of data objects with the thumbnail data included
 * 
 * @param files Array of files to create thumbnails for
 * @param prefix If provided, all filenames will be prefixed with the given string before fetching
 * @returns An array of data objects with the thumbnail data included
 */
export function useThumbnails<T extends FileData>(files: T[], prefix?: string): (T & Thumbnail)[] {
	const [thumbs, setThumbs] = React.useState<(T & Thumbnail)[]>([])

	React.useEffect(() => {
		if (!files.length) return;

		(async () => {
			const thumbs = await createThumbnails(files, prefix)
			setThumbs(thumbs);
		})();
	}, [files, prefix])

	return thumbs;
}
