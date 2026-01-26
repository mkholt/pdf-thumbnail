import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"
import "pdfjs-dist/legacy/build/pdf.worker.mjs"
import { isDefined } from "@mkholt/utilities"
import { FileData, Thumbnail, StringThumbnail, BufferThumbnail } from "../types/index.js"
import { createLogger, type Logger, type LogLevel } from "./logging.js"

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
		const loadingTask = getDocument(file);

		// Set up abort handler if signal provided
		const abortHandler = signal ? () => loadingTask.destroy() : undefined;
		signal?.addEventListener('abort', abortHandler!);

		let doc;
		try {
			doc = await loadingTask.promise;
		} finally {
			signal?.removeEventListener('abort', abortHandler!);
		}

		if (signal?.aborted) {
			doc.destroy();
			log.debug("Operation aborted after document load");
			return undefined;
		}

		const pageToFetch = Math.max(1, Math.min(page, doc.numPages));
		log.debug("PDF loaded,", doc.numPages, "page(s), getting page", pageToFetch)

		const pageObj = await doc.getPage(pageToFetch)

		if (signal?.aborted) {
			doc.destroy();
			log.debug("Operation aborted after page fetch");
			return undefined;
		}

		const toBuffer = output === "buffer"
		const pageThumb = await makeThumbOfPage(pageObj, toBuffer, log, scale)

		doc.destroy()

		log.debug("Thumbnail created for", file, "of type", pageThumb?.thumbType)
		return pageThumb
	} catch (e: unknown) {
		if (signal?.aborted) {
			log.debug("Operation aborted:", file);
			return undefined;
		}
		log.error("Error trying to make thumbnail of file", file)
		log.error(e)
	}
}

type CanvasType = {
	type: 'html'
	canvas: HTMLCanvasElement
} | {
	type: 'node'
	canvas: import("canvas").Canvas
}

async function createCanvas(width: number, height: number): Promise<CanvasType> {
	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height
		return {
			type: 'html',
			canvas
		}
	}

	const { createCanvas } = await import("canvas")
	return {
		type: 'node',
		canvas: createCanvas(width, height)
	}
}

function getResult({canvas, type}: CanvasType, toBuffer: boolean, log: Logger): StringThumbnail | BufferThumbnail {
	log.debug("Page rendered to canvas of type", type)
	const dataUrl = canvas.toDataURL("image/png");

	if (toBuffer) {
		const thumbData = type === "node"
			? canvas.toBuffer("image/png")
			: Buffer.from(dataUrl.split(",")[1], "base64");

		return {
			thumbType: "buffer",
			thumbData
		};
	} else {
		return {
			thumbType: "string",
			thumbData: dataUrl
		}
	}
}

async function makeThumbOfPage(page: PDFPageProxy, toBuffer: boolean, log: Logger, scale: number = 1): Promise<StringThumbnail | BufferThumbnail | undefined> {
	const viewport = page.getViewport({ scale })

	const canvasInfo = await createCanvas(viewport.width, viewport.height)
	const { canvas } = canvasInfo

	log.debug("Rendering page", page.pageNumber, "to canvas", canvas.width, "x", canvas.height)

	await page.render({
		viewport,
		canvas: canvas as unknown as HTMLCanvasElement
	}).promise

	return getResult(canvasInfo, toBuffer, log)
}
