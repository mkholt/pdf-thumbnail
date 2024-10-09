import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"
import "pdfjs-dist/legacy/build/pdf.worker"
import { isDefined } from "@mkholt/utilities"
import { FileData, Thumbnail } from "../types"

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

export async function createThumbnail(file: string, toBuffer: true): Promise<Buffer|undefined>;
export async function createThumbnail(file: string, toBuffer: false): Promise<string|undefined>;
export async function createThumbnail(file: string, toBuffer?: boolean): Promise<string|undefined>;
export async function createThumbnail(file: string, toBuffer: boolean | undefined = false): Promise<string|Buffer|undefined> {	
	try {
		console.log("Attempting to load", file)
		const doc = await getDocument(file).promise
		console.log("[PDF]", "PDF loaded", doc.numPages, "pages")
		const page = await doc.getPage(1)

		return await makeThumbOfPage(page, toBuffer)
	} catch (e: unknown) {
		console.error("Failed to load PDF", file, e)
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

async function makeThumbOfPage(page: PDFPageProxy, toBuffer: boolean): Promise<string|Buffer|undefined> {
	const viewport = page.getViewport({ scale: 1 })

	const { canvas, type } = await createCanvas(viewport.width, viewport.height)
	const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D
	
	if (!context) return undefined;

	console.log("[PDF]", "Rendering page", page.pageNumber, "to canvas", canvas.width, "x", canvas.height)

	await page.render({
		canvasContext: context,
		viewport
	}).promise
	
	console.log("[PDF]", "Page rendered to canvas of type", type)
	if (type == "html") {
		if (toBuffer) {
			throw new Error("Cannot output HTMLCanvasElement to Buffer")
		}

		return canvas.toDataURL("image/png")
	}

	return toBuffer ? canvas.toBuffer("image/png") : canvas.toDataURL("image/png");
}

