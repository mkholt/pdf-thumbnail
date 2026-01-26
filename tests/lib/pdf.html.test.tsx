import { describe, expect, test } from "vitest";
import { createThumbnail } from "../../src/lib/pdf.js";

describe("PDF thumbnail creation using HTMLCanvasElement", () => {
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
})
