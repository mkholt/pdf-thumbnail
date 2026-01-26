import { expect, test, vi } from "vitest";
import { createThumbnail, createThumbnails } from "../../src/lib/pdf.js";
import { FileData } from "../../src/types/index.js";
import { describe } from "node:test";

describe("PDF Thumbnail Creation Tests", () => {
	test("Creating a thumbnail from a PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf");
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData).to.be.a("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
		expect(thumb?.thumbData).toMatch(/^data:image\/png;base64,/);
	});

	test("Creating a thumbnail from a non-PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.jpg");
		expect(thumb).toBeUndefined();
	});

	test("Creating a thumbnail with buffer output from a PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf", true);
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("buffer");
		expect(thumb?.thumbData).toBeInstanceOf(Buffer);
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail with buffer output from a non-PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.jpg", true);
		expect(thumb).toBeUndefined();
	});

	test("Creating a thumbnail from a non-existent file", async () => {
		const thumb = await createThumbnail("tests/nonexistent.pdf");
		expect(thumb).toBeUndefined();
	});

	test("Creating a thumbnail with buffer output from a non-existent file", async () => {
		const thumb = await createThumbnail("tests/nonexistent.pdf", true);
		expect(thumb).toBeUndefined();
	});

	test("Creating thumbnails from multiple PDFs", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(2);
		thumbnails.forEach((thumb, idx) => {
			expect(thumb.thumbData).toBeDefined();
			expect(thumb.thumbData).to.be.a("string");
			expect(thumb.thumbData?.length).toBeGreaterThan(0);
			expect(thumb.thumbData).toMatch(/^data:image\/png;base64,/);
			expect(thumb.file).toBe(files[idx].file);
		});
	});

	test("Creating thumbnails from multiple files including non-PDFs", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.jpg" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].thumbData).toBeDefined();
		expect(thumbnails[0].thumbData).to.be.a("string");
		expect(thumbnails[0].thumbData?.length).toBeGreaterThan(0);
		expect(thumbnails[0].thumbData).toMatch(/^data:image\/png;base64,/);
		expect(thumbnails[0].file).toBe(files[0].file);
	});

	test("Creating thumbnails from multiple files including non-existent files", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/nonexistent.pdf" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].thumbData).toBeDefined();
		expect(thumbnails[0].thumbData).to.be.a("string");
		expect(thumbnails[0].thumbData?.length).toBeGreaterThan(0);
		expect(thumbnails[0].thumbData).toMatch(/^data:image\/png;base64,/);
		expect(thumbnails[0].file).toBe(files[0].file);
	});

	test("Creating thumbnails with prefix", async () => {
		const files: FileData[] = [
			{ file: "sample.pdf" },
			{ file: "sample.pdf" }
		];
		const thumbnails = await createThumbnails(files, { prefix: "tests/samples/" });
		expect(thumbnails).toHaveLength(2);
		thumbnails.forEach((thumb, idx) => {
			expect(thumb.thumbData).toBeDefined();
			expect(thumb.thumbType).toBe("string");
			expect(thumb.thumbData).to.be.a("string");
			expect(thumb.thumbData?.length).toBeGreaterThan(0);
			expect(thumb.thumbData).toMatch(/^data:image\/png;base64,/);
			expect(thumb.file).toBe(files[idx].file);
		});
	});

	test("Creating thumbnails with buffer output", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" }
		];
		const thumbnails = await createThumbnails(files, { output: "buffer" });
		expect(thumbnails).toHaveLength(2);
		thumbnails.forEach((thumb, idx) => {
			expect(thumb.thumbData).toBeDefined();
			expect(thumb.thumbType).toBe("buffer");
			expect(thumb.thumbData).toBeInstanceOf(Buffer);
			expect(thumb.thumbData?.length).toBeGreaterThan(0);
			expect(thumb.file).toBe(files[idx].file);
		});
	});

	test("Creating thumbnails with additional data is preserved", async () => {
		const files = [
			{ file: "tests/samples/sample.pdf", extra: "data" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].thumbData).toBeDefined();
		expect(thumbnails[0].thumbData).to.be.a("string");
		expect(thumbnails[0].thumbData?.length).toBeGreaterThan(0);
		expect(thumbnails[0].thumbData).toMatch(/^data:image\/png;base64,/);
		expect(thumbnails[0].file).toBe(files[0].file);
		expect(thumbnails[0].extra).toBe(files[0].extra);
	});

	test("Creating thumbnails from empty file array returns empty array", async () => {
		const thumbnails = await createThumbnails([]);
		expect(thumbnails).toEqual([]);
	});
})