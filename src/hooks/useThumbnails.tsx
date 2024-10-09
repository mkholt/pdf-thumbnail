import React from "react";
import { FileData, isThumbnailArray, Thumbnail } from "../types/index.js";
import { createThumbnails } from "../lib/index.js";

export function useThumbnails<T extends FileData>(files?: T[], prefix?: string): (T & Thumbnail)[];
export function useThumbnails(files?: Thumbnail[], prefix?: string): Thumbnail[];
export function useThumbnails<T extends FileData>(files?: T[] | Thumbnail[], prefix?: string): (T & Thumbnail)[] | Thumbnail[] {
	const [thumbs, setThumbs] = React.useState<(T & Thumbnail)[] | Thumbnail[]>([])

	React.useEffect(() => {
		if (!files) return;

		if (isThumbnailArray(files)) {
			setThumbs(files);
		}
		else {
			createThumbnails(files, prefix)
				.then(setThumbs);
		}
	}, [files])

	return thumbs;
}
