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
}

/**
 * Options for creating multiple thumbnails
 */
export type CreateThumbnailsOptions = CreateThumbnailOptions & {
	/** If provided, all filenames will be prefixed with the given string before fetching */
	prefix?: string;
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

	const { prefix, output, logLevel = "error" } = options ?? {};

	const filePromises = files
		.filter(d => d.file)
		.map(async (d) => {
			const thumb = await createThumbnail(`${prefix ?? ""}${d.file}`, { output, logLevel });
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
	const { output, logLevel = "error" } = options ?? {};
	const log = createLogger(logLevel);
	
	try {
		log.debug("Loading file", file)
		const doc = await getDocument(file).promise
		log.debug("PDF loaded,", doc.numPages, "page(s), getting page 1")

		const page = await doc.getPage(1)

		const toBuffer = output === "buffer"
		const pageThumb = await makeThumbOfPage(page, toBuffer, log)

		doc.destroy()

		log.debug("Thumbnail created for", file, "of type", pageThumb?.thumbType)
		return pageThumb
	} catch (e: unknown) {
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

async function makeThumbOfPage(page: PDFPageProxy, toBuffer: boolean, log: Logger): Promise<StringThumbnail | BufferThumbnail | undefined> {
	const viewport = page.getViewport({ scale: 1 })

	const canvasInfo = await createCanvas(viewport.width, viewport.height)
	const { canvas } = canvasInfo

	log.debug("Rendering page", page.pageNumber, "to canvas", canvas.width, "x", canvas.height)

	await page.render({
		viewport,
		canvas: canvas as unknown as HTMLCanvasElement
	}).promise

	return getResult(canvasInfo, toBuffer, log)
}
