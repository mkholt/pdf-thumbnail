import React from "react";
import { FileData, StringThumbnail, ErrorThumbnail } from "../types/index.js";
import { createThumbnails } from "../lib/index.js";

export type UseThumbnailsOptions = {
	/** If provided, all filenames will be prefixed with the given string before fetching */
	prefix?: string;

	/** Scale factor for thumbnails (default: 1) */
	scale?: number;

	/** Page number to create thumbnail from (default: 1) */
	page?: number;
}

export type UseThumbnailsResult<T extends FileData> = {
	/** The generated thumbnails */
	thumbnails: (T & StringThumbnail)[];

	/** Whether thumbnails are currently being generated */
	isLoading: boolean;

	/** Error that occurred during generation, if any */
	error: Error | null;
}

/**
 * Given an array of files, creates thumbnails for each file and returns an object with the thumbnail data, loading state, and any error
 *
 * @param files Array of files to create thumbnails for
 * @param options Options for thumbnail creation
 * @returns An object containing thumbnails array, isLoading boolean, and error (if any)
 */
type State<T extends FileData> = {
	thumbnails: (T & StringThumbnail)[];
	isLoading: boolean;
	error: Error | null;
}

export function useThumbnails<T extends FileData>(files: T[], options?: UseThumbnailsOptions): UseThumbnailsResult<T> {
	const [state, setState] = React.useState<State<T>>({
		thumbnails: [],
		isLoading: false,
		error: null,
	});

	React.useEffect(() => {
		if (!files.length) {
			// Only reset if we have data to clear
			setState(prev => {
				if (prev.thumbnails.length > 0 || prev.isLoading || prev.error) {
					return { thumbnails: [], isLoading: false, error: null };
				}
				return prev;
			});
			return;
		}

		const abortController = new AbortController();
		let isCancelled = false;

		setState(prev => ({ ...prev, isLoading: true, error: null }));

		createThumbnails(files, {
			...options,
			signal: abortController.signal,
		}).then(results => {
			if (!isCancelled) {
				const successes = results.filter(
					(r): r is T & StringThumbnail => r.thumbType !== "error"
				);
				const failures = results.filter(
					(r): r is T & ErrorThumbnail => r.thumbType === "error"
				);

				setState({
					thumbnails: successes,
					isLoading: false,
					error: failures.length > 0
						? new Error(failures.map(e => `${e.file}: ${e.thumbData}`).join("; "))
						: null,
				});
			}
		}).catch(err => {
			if (!isCancelled) {
				setState(prev => ({
					...prev,
					isLoading: false,
					error: err instanceof Error ? err : new Error(String(err)),
				}));
			}
		});

		return () => {
			isCancelled = true;
			abortController.abort();
		};
	}, [files, options?.prefix, options?.scale, options?.page]);

	return state;
}
