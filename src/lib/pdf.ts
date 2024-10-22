import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"
import "pdfjs-dist/legacy/build/pdf.worker"
import { isDefined } from "@mkholt/utilities"
import { FileData, Thumbnail } from "../types/index.js"

/**
 * Given an array of files, creates thumbnails for each file and returns an array of data objects with the thumbnail data included
 * 
 * @param files The files to create thumbnails for
 * @param prefix If provided, all filenames will be prefixed with the given string before fetching
 * @returns The files with the thumbnail data included
 */
export async function createThumbnails<T extends FileData>(files: T[], prefix?: string): Promise<(T & Thumbnail)[]> {
	const filePromises = files
		.filter(d => d.file)
		.map(async (d) => {
			const thumb = await createThumbnail(`${prefix ?? ""}${d.file}`);
			return thumb
				? { ...d, thumbData: thumb } satisfies (T & Thumbnail)
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
export async function createThumbnail(file: string, toBuffer: true): Promise<Buffer | undefined>;
export async function createThumbnail(file: string, toBuffer: false): Promise<string | undefined>;
export async function createThumbnail(file: string, toBuffer?: boolean): Promise<string | undefined>;
export async function createThumbnail(file: string, toBuffer: boolean | undefined = false): Promise<string | Buffer | undefined> {
	try {
		console.debug("[PDF]", "Loading file", file)
		const doc = await getDocument(file).promise
		console.debug("[PDF]", "PDF loaded,", doc.numPages, "page(s)")

		const page = await doc.getPage(1)

		const pageThumb = await makeThumbOfPage(page, toBuffer)
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

function getResult({canvas, type}: CanvasType, toBuffer: boolean): string|Buffer {
	const dataUrl = canvas.toDataURL("image/png");
	switch (type) {
		case "node":
			return toBuffer ? canvas.toBuffer("image/png") : dataUrl;
		case "html":
			const base64 = dataUrl.split(",")[1];
			return toBuffer ? Buffer.from(base64, "base64") : dataUrl;
	}
}

async function makeThumbOfPage(page: PDFPageProxy, toBuffer: boolean): Promise<string | Buffer | undefined> {
	const viewport = page.getViewport({ scale: 1 })

	const canvasInfo = await createCanvas(viewport.width, viewport.height)
	const { canvas, type } = canvasInfo
	const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D

	if (!context) {
		console.debug("[PDF]", "Could not get 2D context for canvas")
		return undefined;
	}

	console.debug("[PDF]", "Rendering page", page.pageNumber, "to canvas", canvas.width, "x", canvas.height)

	await page.render({
		canvasContext: context,
		viewport
	}).promise

	console.debug("[PDF]", "Page rendered to canvas of type", type)
	return getResult(canvasInfo, toBuffer)
}

