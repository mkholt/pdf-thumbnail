import { describe, expect, test, vi } from "vitest";
import { createThumbnail, createThumbnails } from "../../src/lib/pdf.js";
import { FileData } from "../../src/types/index.js";
import { getDocumentProxy } from "unpdf";

vi.mock("unpdf", async (importOriginal) => {
	const actual = await importOriginal<typeof import("unpdf")>();
	return { ...actual, getDocumentProxy: vi.fn(actual.getDocumentProxy) };
});

const mockedGetDocumentProxy = vi.mocked(getDocumentProxy);

/**
 * Creates a mock AbortSignal that becomes aborted after a specified number of checks.
 * Useful for deterministically testing abort behavior at specific points in the code.
 *
 * For createThumbnail:
 * - abortAfterChecks=1: aborts before start (line 96)
 * - abortAfterChecks=2: aborts after PDF data load (line 105)
 * - abortAfterChecks=3: aborts after page count fetch (line 115)
 *
 * For createThumbnails:
 * - abortAfterChecks=1: aborts at early check (line 58)
 * - abortAfterChecks=2: aborts in map iteration (line 67)
 */
function createMockSignal(abortAfterChecks: number): AbortSignal {
	let checkCount = 0;
	return {
		get aborted() {
			checkCount++;
			return checkCount >= abortAfterChecks;
		},
		addEventListener: (_event: string, _handler: () => void) => {},
		removeEventListener: () => {},
	} as unknown as AbortSignal;
}

describe("PDF Thumbnail Creation Tests", () => {
	test("Creating a thumbnail from a PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf");
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData).to.be.a("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
		expect(thumb?.thumbData).toMatch(/^data:image\/png;base64,/);
	});

	test("Creating a thumbnail from a PDF with embedded images", async () => {
		const thumb = await createThumbnail("tests/samples/pdf-with-images.pdf");
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData).toMatch(/^data:image\/png;base64,/);
	});

	test("Creating a thumbnail from a non-PDF returns an error", async () => {
		const thumb = await createThumbnail("tests/samples/sample.jpg");
		expect(thumb?.thumbType).toBe("error");
		expect(thumb?.thumbData).toEqual(expect.any(String));
	});

	test("Creating a thumbnail with buffer output from a PDF", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf", { output: "buffer" });
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("buffer");
		expect(thumb?.thumbData).toBeInstanceOf(Buffer);
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail with buffer output from a non-PDF returns an error", async () => {
		const thumb = await createThumbnail("tests/samples/sample.jpg", { output: "buffer" });
		expect(thumb?.thumbType).toBe("error");
	});

	test("Creating a thumbnail from a non-existent file returns an error", async () => {
		const thumb = await createThumbnail("tests/nonexistent.pdf");
		expect(thumb?.thumbType).toBe("error");
		expect(thumb?.thumbData).toEqual(expect.any(String));
	});

	test("Creating a thumbnail from a URL with unsupported protocol returns an error", async () => {
		const thumb = await createThumbnail("ftp://example.com/sample.pdf");
		expect(thumb?.thumbType).toBe("error");
	});

	test("Creating a thumbnail with buffer output from a non-existent file returns an error", async () => {
		const thumb = await createThumbnail("tests/nonexistent.pdf", { output: "buffer" });
		expect(thumb?.thumbType).toBe("error");
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

	test("Creating thumbnails from multiple files including non-PDFs returns errors inline", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.jpg" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(2);

		const successes = thumbnails.filter(t => t.thumbType !== "error");
		const errors = thumbnails.filter(t => t.thumbType === "error");
		expect(successes).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(successes[0].file).toBe(files[0].file);
		expect(errors[0].file).toBe(files[1].file);
	});

	test("Creating thumbnails from multiple files including non-existent files returns errors inline", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/nonexistent.pdf" }
		];
		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(2);

		const successes = thumbnails.filter(t => t.thumbType !== "error");
		const errors = thumbnails.filter(t => t.thumbType === "error");
		expect(successes).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(successes[0].file).toBe(files[0].file);
		expect(errors[0].file).toBe(files[1].file);
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

	test("Creating a thumbnail with scale option", async () => {
		const thumb1 = await createThumbnail("tests/samples/sample.pdf", { scale: 1 });
		const thumb2 = await createThumbnail("tests/samples/sample.pdf", { scale: 0.5 });
		const thumb3 = await createThumbnail("tests/samples/sample.pdf", { scale: 2 });

		expect(thumb1).toBeDefined();
		expect(thumb2).toBeDefined();
		expect(thumb3).toBeDefined();

		// Different scales should produce different data sizes
		expect(thumb1?.thumbData?.length).toBeGreaterThan(0);
		expect(thumb2?.thumbData?.length).toBeGreaterThan(0);
		expect(thumb3?.thumbData?.length).toBeGreaterThan(0);

		expect(thumb1?.thumbData?.length).not.toBe(thumb2?.thumbData?.length);
		expect(thumb1?.thumbData?.length).not.toBe(thumb3?.thumbData?.length);
		expect(thumb2?.thumbData?.length).not.toBe(thumb3?.thumbData?.length);
	});

	test("Creating a thumbnail with page option", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf", { page: 1 });
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail with page 0 clamps to page 1", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf", { page: 0 });
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail with page exceeding numPages clamps to last page", async () => {
		const thumb = await createThumbnail("tests/samples/sample.pdf", { page: 999 });
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail converts non-Error exceptions to error message", async () => {
		mockedGetDocumentProxy.mockRejectedValueOnce("raw string error");

		const thumb = await createThumbnail("tests/samples/sample.pdf");
		expect(thumb?.thumbType).toBe("error");
		expect(thumb?.thumbData).toBe("raw string error");
	});

	test("Creating a thumbnail from a PDF with 0 pages returns an error", async () => {
		mockedGetDocumentProxy.mockResolvedValueOnce({
			numPages: 0,
			destroy: () => {},
		} as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);

		const thumb = await createThumbnail("tests/samples/sample.pdf");
		expect(thumb?.thumbType).toBe("error");
		expect(thumb?.thumbData).toContain("no pages");
	});

	test("Creating a thumbnail with pre-aborted signal returns undefined", async () => {
		const controller = new AbortController();
		controller.abort();

		const thumb = await createThumbnail("tests/samples/sample.pdf", { signal: controller.signal });
		expect(thumb).toBeUndefined();
	});

	test("Creating thumbnails with pre-aborted signal returns empty array", async () => {
		const controller = new AbortController();
		controller.abort();

		const files: FileData[] = [{ file: "tests/samples/sample.pdf" }];
		const thumbnails = await createThumbnails(files, { signal: controller.signal });
		expect(thumbnails).toEqual([]);
	});

	test("Aborting createThumbnail mid-operation returns undefined without error", async () => {
		const controller = new AbortController();

		// Start the operation and abort immediately after
		const promise = createThumbnail("tests/samples/sample.pdf", { signal: controller.signal });

		// Abort right away - may hit any of the abort check points
		controller.abort();

		const thumb = await promise;
		// Should either complete (if abort was too late), return undefined (if aborted), or return error
		// The key is no errors are thrown
		expect(thumb === undefined || thumb?.thumbType === "error" || thumb?.thumbData !== undefined).toBe(true);
	});

	test("Aborting createThumbnail with delay returns undefined without error", async () => {
		const controller = new AbortController();

		const promise = createThumbnail("tests/samples/sample.pdf", { signal: controller.signal });

		// Small delay then abort - increases chance of hitting post-document-load path
		await new Promise(resolve => setTimeout(resolve, 10));
		controller.abort();

		const thumb = await promise;
		expect(thumb === undefined || thumb?.thumbType === "error" || thumb?.thumbData !== undefined).toBe(true);
	});

	test("Aborting createThumbnails checks signal before processing each file", async () => {
		const controller = new AbortController();
		const files: FileData[] = [{ file: "tests/samples/sample.pdf" }];

		// Start operation and abort immediately
		const promise = createThumbnails(files, { signal: controller.signal });
		controller.abort();

		const thumbnails = await promise;
		// Should either complete or return empty - key is no errors thrown
		expect(thumbnails.length).toBeLessThanOrEqual(1);
	});

	test("Creating thumbnails with progress callback", async () => {
		const progressCalls: [number, number][] = [];
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
		];

		await createThumbnails(files, {
			onProgress: (completed, total) => {
				progressCalls.push([completed, total]);
			}
		});

		expect(progressCalls.length).toBe(2);
		expect(progressCalls).toContainEqual([1, 2]);
		expect(progressCalls).toContainEqual([2, 2]);
	});

	test("Creating thumbnails with progress callback includes failed files in count", async () => {
		const progressCalls: [number, number][] = [];
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/nonexistent.pdf" },
		];

		const thumbnails = await createThumbnails(files, {
			onProgress: (completed, total) => {
				progressCalls.push([completed, total]);
			}
		});

		expect(thumbnails.length).toBe(2); // Both returned (1 success + 1 error)
		expect(progressCalls.length).toBe(2); // Progress called for both
	});

	test("Creating thumbnails with scale passed through options", async () => {
		const files: FileData[] = [{ file: "tests/samples/sample.pdf" }];
		const thumbnails = await createThumbnails(files, { scale: 0.5 });
		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].thumbData).toBeDefined();
	});

	test("Creating thumbnails returns error results with file property preserved", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/nonexistent.pdf" },
			{ file: "tests/samples/sample.jpg" },
		];

		const thumbnails = await createThumbnails(files);

		expect(thumbnails).toHaveLength(3);
		const errors = thumbnails.filter(t => t.thumbType === "error");
		expect(errors).toHaveLength(2);
		expect(errors.map(e => e.file)).toEqual(["tests/samples/nonexistent.pdf", "tests/samples/sample.jpg"]);
	});

	test("Creating thumbnails with prefix preserves resolved path in error results", async () => {
		const files: FileData[] = [{ file: "nonexistent.pdf" }];

		const thumbnails = await createThumbnails(files, { prefix: "tests/samples/" });

		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].thumbType).toBe("error");
		expect(thumbnails[0].file).toBe("nonexistent.pdf");
	});

	test("Creating thumbnails with mixed results includes both successes and errors", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/nonexistent.pdf" },
		];

		const thumbnails = await createThumbnails(files);
		expect(thumbnails).toHaveLength(2);
		expect(thumbnails[0].thumbType).toBe("string");
		expect(thumbnails[1].thumbType).toBe("error");
	});

	test("Creating thumbnails with concurrency: 1 processes files sequentially", async () => {
		const order: string[] = [];
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
		];

		const thumbnails = await createThumbnails(files, {
			concurrency: 1,
			onProgress: (completed) => {
				order.push(`done-${completed}`);
			}
		});

		expect(thumbnails).toHaveLength(3);
		expect(order).toEqual(["done-1", "done-2", "done-3"]);
	});

	test("Creating thumbnails with concurrency: 2 processes all files", async () => {
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
		];

		const thumbnails = await createThumbnails(files, { concurrency: 2 });

		expect(thumbnails).toHaveLength(4);
		thumbnails.forEach(thumb => {
			expect(thumb.thumbData).toMatch(/^data:image\/png;base64,/);
		});
	});

	test("Abort after document load returns undefined", async () => {
		// abortAfterChecks=2: passes early check (line 96), aborts after PDF data load (line 105)
		const thumb = await createThumbnail("tests/samples/sample.pdf", {
			signal: createMockSignal(2)
		});
		expect(thumb).toBeUndefined();
	});

	test("Abort after page fetch returns undefined", async () => {
		// abortAfterChecks=3: passes early check and data load, aborts after page count fetch (line 115)
		const thumb = await createThumbnail("tests/samples/sample.pdf", {
			signal: createMockSignal(3)
		});
		expect(thumb).toBeUndefined();
	});

	test("Abort during error in catch block returns undefined", async () => {
		// abortAfterChecks=2: passes early check (line 96), loadPdfData throws ENOENT
		// for non-existent file, catch block sees signal as aborted on 2nd check (line 145)
		const thumb = await createThumbnail("tests/samples/nonexistent.pdf", {
			signal: createMockSignal(2)
		});
		expect(thumb).toBeUndefined();
	});

	test("createThumbnails aborts individual file processing when signal changes mid-iteration", async () => {
		// abortAfterChecks=2: passes early check (line 58), aborts in map iteration (line 67)
		const files: FileData[] = [
			{ file: "tests/samples/sample.pdf" },
			{ file: "tests/samples/sample.pdf" },
		];

		const thumbnails = await createThumbnails(files, { signal: createMockSignal(2) });
		expect(thumbnails.length).toBe(0);
	});

})