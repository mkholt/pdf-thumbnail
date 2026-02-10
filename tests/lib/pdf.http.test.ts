import { describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, sampleData } from "../setup.http.js";
import { createThumbnail } from "../../src/lib/pdf.js";

function createPdfResponse() {
	const buf = new ArrayBuffer(sampleData.length);
	new Uint8Array(buf).set(sampleData);
	return HttpResponse.arrayBuffer(buf, {
		headers: { 'Content-Type': 'application/pdf' }
	});
}

describe("PDF thumbnail creation via HTTP URL", () => {
	test("Creating a thumbnail from a PDF", async () => {
		const thumb = await createThumbnail("http://localhost:3000/samples/sample.pdf");
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData).to.be.a("string");
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
		expect(thumb?.thumbData).toMatch(/^data:image\/png;base64,/);
	});

	test("Creating a thumbnail with buffer output from a PDF", async () => {
		const thumb = await createThumbnail("http://localhost:3000/samples/sample.pdf", { output: "buffer" });
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("buffer");
		expect(thumb?.thumbData).toBeInstanceOf(Buffer);
		expect(thumb?.thumbData?.length).toBeGreaterThan(0);
	});

	test("Creating a thumbnail from a non-2xx response returns undefined", async () => {
		server.use(
			http.get('http://localhost:3000/samples/:filename', () => {
				return new HttpResponse(null, { status: 404 })
			})
		);

		const thumb = await createThumbnail("http://localhost:3000/samples/notfound.pdf");
		expect(thumb).toBeUndefined();
	});

	test("Creating a thumbnail from an HTTPS URL", async () => {
		server.use(
			http.get('https://example.com/sample.pdf', () => createPdfResponse())
		);

		const thumb = await createThumbnail("https://example.com/sample.pdf");
		expect(thumb).toBeDefined();
		expect(thumb?.thumbType).toBe("string");
		expect(thumb?.thumbData).toMatch(/^data:image\/png;base64,/);
	});

	test("canvasImport is undefined in non-Node environment", async () => {
		vi.resetModules();
		const origNode = process.versions.node;
		Object.defineProperty(process.versions, 'node', { value: '', configurable: true });

		try {
			const mod = await import('../../src/lib/pdf.js');
			// With isNodeRuntime=false, canvasImport is undefined.
			// renderPageAsImage fails without canvas in Node, so returns undefined.
			const thumb = await mod.createThumbnail("http://localhost:3000/samples/sample.pdf");
			expect(thumb).toBeUndefined();
		} finally {
			Object.defineProperty(process.versions, 'node', { value: origNode, configurable: true });
			vi.resetModules();
		}
	});
})
