import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"
import "pdfjs-dist/legacy/build/pdf.worker.mjs"
import { isDefined } from "@mkholt/utilities"
import { FileData, Thumbnail, StringThumbnail, BufferThumbnail } from "../types/index.js"

/**
 * Given an array of files, creates thumbnails for each file and returns an array of data objects with the thumbnail data included
 * 
 * @param files The files to create thumbnails for
 * @param prefix If provided, all filenames will be prefixed with the given string before fetching
 * @returns The files with the thumbnail data included
 */
export async function createThumbnails<T extends FileData>(files: T[], prefix?: string): Promise<(T & StringThumbnail)[]>;
export async function createThumbnails<T extends FileData>(files: T[], prefix: string | undefined, toBuffer: true): Promise<(T & BufferThumbnail)[]>;
export async function createThumbnails<T extends FileData>(files: T[], prefix: string | undefined, toBuffer: false): Promise<(T & StringThumbnail)[]>;
export async function createThumbnails<T extends FileData>(files: T[], prefix?: string, toBuffer?: boolean): Promise<(T & Thumbnail)[]> {
	if (!files.length) return [];

	const filePromises = files
		.filter(d => d.file)
		.map(async (d) => {
			const thumb = await createThumbnail(`${prefix ?? ""}${d.file}`, toBuffer);
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
 * @param toBuffer If `true` the thumbnail will be returned as a `Buffer` object, otherwise it will be returned as a base64 encoded dataURL string
 */
export async function createThumbnail(file: string): Promise<StringThumbnail | undefined>;
export async function createThumbnail(file: string, toBuffer: true): Promise<BufferThumbnail | undefined>;
export async function createThumbnail(file: string, toBuffer: false): Promise<StringThumbnail | undefined>;
export async function createThumbnail(file: string, toBuffer?: boolean): Promise<StringThumbnail | BufferThumbnail | undefined>;
export async function createThumbnail(file: string, toBuffer: boolean | undefined = false): Promise<StringThumbnail | BufferThumbnail | undefined> {
	try {
		console.debug("[PDF]", "Loading file", file)
		const doc = await getDocument(file).promise
		console.debug("[PDF]", "PDF loaded,", doc.numPages, "page(s)")

		const page = await doc.getPage(1)

		const pageThumb = await makeThumbOfPage(page, toBuffer)

		doc.destroy()

		console.debug("[PDF]", "Thumbnail created for", file, "of type", typeof pageThumb)
		return pageThumb
	} catch (e: unknown) {
		console.error("Error trying to make thumbnail of file", file)
		console.error(e)
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

function getResult({canvas, type}: CanvasType, toBuffer: boolean): StringThumbnail | BufferThumbnail {
	console.debug("[PDF]", "Page rendered to canvas of type", type)
	const dataUrl = canvas.toDataURL("image/png");

	if (type === "node") {
		return toBuffer
			? {
				thumbType: "buffer",
				thumbData: canvas.toBuffer("image/png")
			} : {
				thumbType: "string",
				thumbData: dataUrl
			};
	} else {
		const base64 = dataUrl.split(",")[1];
		return toBuffer
			? {
				thumbType: "buffer",
				thumbData: Buffer.from(base64, "base64")
			} : {
				thumbType: "string",
				thumbData: dataUrl
			};
	}
}

async function makeThumbOfPage(page: PDFPageProxy, toBuffer: boolean): Promise<StringThumbnail | BufferThumbnail | undefined> {
	const viewport = page.getViewport({ scale: 1 })

	const canvasInfo = await createCanvas(viewport.width, viewport.height)
	const { canvas } = canvasInfo

	console.debug("[PDF]", "Rendering page", page.pageNumber, "to canvas", canvas.width, "x", canvas.height)

	await page.render({
		viewport,
		canvas: canvas as unknown as HTMLCanvasElement
	}).promise

	return getResult(canvasInfo, toBuffer)
}
