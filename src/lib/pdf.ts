import { renderPageAsImage, getDocumentProxy, createIsomorphicCanvasFactory } from "unpdf"
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

	/** Maximum number of files to process simultaneously (default: Infinity) */
	concurrency?: number;

	/** Callback for progress updates during batch processing */
	onProgress?: (completed: number, total: number) => void;

	/** Callback invoked when a file fails to generate a thumbnail */
	onError?: (file: string) => void;
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

	const { prefix, output, logLevel = "error", scale, page, signal, concurrency = Infinity, onProgress, onError } = options ?? {};

	if (signal?.aborted) {
		return [];
	}

	const validFiles = files.filter(d => d.file);
	const total = validFiles.length;
	let completed = 0;

	const processFile = async (d: T): Promise<(T & Thumbnail) | undefined> => {
		if (signal?.aborted) {
			return undefined;
		}

		const resolvedFile = `${prefix ?? ""}${d.file}`;
		const thumb = await createThumbnail(resolvedFile, { output, logLevel, scale, page, signal });

		completed++;
		onProgress?.(completed, total);

		if (!thumb) {
			onError?.(resolvedFile);
			return undefined;
		}

		return { ...d, ...thumb } satisfies (T & Thumbnail);
	};

	const thumbnails = await mapWithConcurrency(validFiles, concurrency, processFile);
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

	let doc: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
	try {
		log.debug("Loading file", file)
		const pdfData = await loadPdfData(file, signal)

		if (signal?.aborted) {
			log.debug("Operation aborted after document load");
			return undefined;
		}

		const canvasImport = isNodeRuntime ? () => import("@napi-rs/canvas") : undefined
		const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport)
		doc = await getDocumentProxy(new Uint8Array(pdfData), { CanvasFactory })

		if (doc.numPages === 0) {
			log.error("PDF has no pages:", file);
			return undefined;
		}

		const pageToFetch = Math.max(1, Math.min(page, doc.numPages));
		log.debug("PDF loaded,", doc.numPages, "page(s), getting page", pageToFetch)

		if (signal?.aborted) {
			log.debug("Operation aborted after page fetch");
			return undefined;
		}

		const renderOptions = { canvasImport, scale }
		
		if (output === "buffer") {
			const data = await renderPageAsImage(doc, pageToFetch, renderOptions)
			log.debug("Thumbnail created for", file, "of type", "buffer")
			return { thumbType: "buffer", thumbData: Buffer.from(data) }
		}

		const data = await renderPageAsImage(doc, pageToFetch, { ...renderOptions, toDataURL: true })
		log.debug("Thumbnail created for", file, "of type", "string")
		return { thumbType: "string", thumbData: data }
	} catch (e: unknown) {
		if (signal?.aborted) {
			log.debug("Operation aborted:", file);
			return undefined;
		}
		log.error("Error trying to make thumbnail of file", file)
		log.error(e)
	} finally {
		doc?.destroy()
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

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const i = nextIndex++;
			results[i] = await fn(items[i]);
		}
	}

	const workerCount = Math.min(Math.max(1, concurrency), items.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
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
