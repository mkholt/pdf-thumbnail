import { renderPageAsImage, getDocumentProxy } from "unpdf"
import { FileData, Thumbnail, StringThumbnail, BufferThumbnail } from "../types/index.js"
import { createLogger, type LogLevel } from "./logging.js"

export type { LogLevel } from "./logging.js"

/**
 * Options for creating a single thumbnail
 */
export type CreateThumbnailOptions = {
	/** The output format: "string" for base64 dataURL (default) or "buffer" for Buffer */
	output?: Thumbnail["thumbType"];

	/**
	 * Controls logging verbosity:
	 * - "silent": No logging
	 * - "error": Only errors (default)
	 * - "debug": Verbose debug output
	 */
	logLevel?: LogLevel;

	/** Scale factor for the thumbnail (default: 1). Higher values produce larger thumbnails. */
	scale?: number;

	/** Page number to create thumbnail from (default: 1). Clamped to valid range. */
	page?: number;

	/** AbortSignal to cancel the operation */
	signal?: AbortSignal;
}

/**
 * Options for creating multiple thumbnails
 */
export type CreateThumbnailsOptions = CreateThumbnailOptions & {
	/** If provided, all filenames will be prefixed with the given string before fetching */
	prefix?: string;

	/** Callback for progress updates during batch processing */
	onProgress?: (completed: number, total: number) => void;
}

/**
 * Given an array of files, creates thumbnails for each file and returns an array of data objects with the thumbnail data included
 *
 * @param files The files to create thumbnails for
 * @param options Options for thumbnail creation
 * @returns The files with the thumbnail data included
 */
export async function createThumbnails<T extends FileData>(files: T[], options: CreateThumbnailsOptions & { output: "buffer" }): Promise<(T & BufferThumbnail)[]>;
export async function createThumbnails<T extends FileData>(files: T[], options?: CreateThumbnailsOptions): Promise<(T & StringThumbnail)[]>;
export async function createThumbnails<T extends FileData>(files: T[], options?: CreateThumbnailsOptions): Promise<(T & Thumbnail)[]> {
	if (!files.length) return [];

	const { prefix, output, logLevel = "error", scale, page, signal, onProgress } = options ?? {};

	if (signal?.aborted) {
		return [];
	}

	const validFiles = files.filter(d => d.file);
	const total = validFiles.length;
	let completed = 0;

	const filePromises = validFiles.map(async (d) => {
		if (signal?.aborted) {
			return undefined;
		}

		const thumb = await createThumbnail(`${prefix ?? ""}${d.file}`, { output, logLevel, scale, page, signal });

		completed++;
		onProgress?.(completed, total);

		return thumb
			? { ...d, ...thumb } satisfies (T & Thumbnail)
			: undefined;
	});

	const thumbnails = await Promise.all(filePromises);
	return thumbnails.filter(isDefined);
}

/**
 * Creates a thumbnail for a given PDF file
 * @param file The file to create a thumbnail for
 * @param options Options for thumbnail creation
 */
export async function createThumbnail(file: string, options: CreateThumbnailOptions & { output: "buffer" }): Promise<BufferThumbnail | undefined>;
export async function createThumbnail(file: string, options?: CreateThumbnailOptions): Promise<StringThumbnail | undefined>;
export async function createThumbnail(file: string, options?: CreateThumbnailOptions): Promise<StringThumbnail | BufferThumbnail | undefined> {
	const { output, logLevel = "error", scale = 1, page = 1, signal } = options ?? {};
	const log = createLogger(logLevel);

	if (signal?.aborted) {
		log.debug("Operation aborted before start");
		return undefined;
	}

	try {
		log.debug("Loading file", file)
		const pdfData = await loadPdfData(file, signal)

		if (signal?.aborted) {
			log.debug("Operation aborted after document load");
			return undefined;
		}

		const doc = await getDocumentProxy(new Uint8Array(pdfData))
		const numPages = doc.numPages;
		doc.destroy()

		if (numPages === 0) {
			log.error("PDF has no pages:", file);
			return undefined;
		}

		const pageToFetch = Math.max(1, Math.min(page, numPages));
		log.debug("PDF loaded,", numPages, "page(s), getting page", pageToFetch)

		if (signal?.aborted) {
			log.debug("Operation aborted after page fetch");
			return undefined;
		}

		const canvasImport = isNodeRuntime ? () => import("@napi-rs/canvas") : undefined

		if (output === "buffer") {
			const arrayBuffer = await renderPageAsImage(new Uint8Array(pdfData), pageToFetch, {
				canvasImport,
				scale
			})
			log.debug("Thumbnail created for", file, "of type", "buffer")
			return {
				thumbType: "buffer",
				thumbData: Buffer.from(arrayBuffer)
			}
		}

		const dataUrl = await renderPageAsImage(new Uint8Array(pdfData), pageToFetch, {
			canvasImport,
			scale,
			toDataURL: true
		})
		log.debug("Thumbnail created for", file, "of type", "string")
		return {
			thumbType: "string",
			thumbData: dataUrl
		}
	} catch (e: unknown) {
		if (signal?.aborted) {
			log.debug("Operation aborted:", file);
			return undefined;
		}
		log.error("Error trying to make thumbnail of file", file)
		log.error(e)
	}
}

const isNodeRuntime = typeof process !== "undefined" && !!process.versions?.node

async function loadPdfData(file: string, signal?: AbortSignal): Promise<Uint8Array> {
	if (isNodeRuntime && !isUrl(file)) {
		const { readFile } = await import("fs/promises")
		return new Uint8Array(await readFile(file))
	}

	const response = await fetch(file, { signal })
	if (!response.ok) {
		throw new Error(`Failed to load PDF from "${file}": ${response.status} ${response.statusText}`)
	}
	return new Uint8Array(await response.arrayBuffer())
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

function isUrl(str: string): boolean {
	try {
		const url = new URL(str)
		return (
			url.protocol === "http:" ||
			url.protocol === "https:" ||
			url.protocol === "data:" ||
			url.protocol === "blob:"
		)
	} catch {
		return false
	}
}
