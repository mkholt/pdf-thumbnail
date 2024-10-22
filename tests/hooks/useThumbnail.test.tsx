/// <reference types="vitest/jsdom" />

import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useThumbnails } from '../../src/hooks/useThumbnails.js';
import React from "react";
import { FileData } from "../../src/types/fileData.js";

const THUMBDATA="data:image/png;base64,..."

describe('useThumbnails hook', () => {
	vi.mock("../../src/lib/index.js", () => {
		return {
			createThumbnails: vi.fn(async <T extends FileData>(files: T[], prefix?: string) => {
				console.log("Mock called with", files, prefix);
				return files.map((file) => ({ ...file, thumbData: THUMBDATA }));
			})
		}
	})

	afterEach(() => {
		cleanup();
	})

	it('should initialize with an empty array', () => {
		const { result } = renderHook(() => useThumbnails([]));

		expect(result.current).toEqual([]);
	});

	it('should return an array of thumbnails', async () => {
		const { result } = renderHook(() => useThumbnails([{ file: "samples/sample1.pdf" }, { file: "samples/sample2.pdf" }]));
		await waitFor(() => expect(result.current).toHaveLength(2));

		expect(result.current).toEqual([
			{ file: "samples/sample1.pdf", thumbData: THUMBDATA },
			{ file: "samples/sample2.pdf", thumbData: THUMBDATA }
		]);
	});

	it('should return an array of thumbnails with a prefix', async () => {
		const { result } = renderHook(() => useThumbnails([{ file: "sample1.pdf" }, { file: "sample2.pdf" }], "samples/"));
		await waitFor(() => expect(result.current).toHaveLength(2));

		expect(result.current).toEqual([
			{ file: "sample1.pdf", thumbData: THUMBDATA },
			{ file: "sample2.pdf", thumbData: THUMBDATA }
		]);
	});
});

const ThumbnailWrapper = ({ files, prefix }: { files: (FileData & { thumbData?: string })[], prefix?: string }) => {
	const thumbs = useThumbnails(files, prefix);

	return (
		<div data-testid="thumbnail-wrapper">
			{thumbs.map((thumb, idx) => (
				<img key={idx} src={thumb.thumbData} alt={thumb.file} data-testid="thumbnail" />
			))}
		</div>
	);
}