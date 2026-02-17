/// <reference types="vitest/jsdom" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useThumbnails } from '../../src/hooks/useThumbnails.js';
import type { FileData, StringThumbnail, ErrorThumbnail } from '../../src/types/index.js';

// Mock the createThumbnails function to avoid canvas/pdfjs issues in jsdom
vi.mock('../../src/lib/index.js', () => ({
	createThumbnails: vi.fn()
}));

import { createThumbnails } from '../../src/lib/index.js';
const mockedCreateThumbnails = vi.mocked(createThumbnails);

// Helper to create mock thumbnail results
const createMockThumbnails = <T extends FileData>(files: T[]): (T & StringThumbnail)[] => {
	return files.map(f => ({
		...f,
		thumbType: 'string' as const,
		thumbData: `data:image/png;base64,mock-${f.file}`
	}));
};

describe('useThumbnails hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initial state', () => {
		it('should return initial state with empty thumbnails, not loading, and no error', () => {
			mockedCreateThumbnails.mockResolvedValue([]);

			const { result } = renderHook(() => useThumbnails([]));

			expect(result.current.thumbnails).toEqual([]);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBeNull();
		});
	});

	describe('loading state', () => {
		it('should set isLoading to true while fetching thumbnails', async () => {
			let resolvePromise: (value: (FileData & StringThumbnail)[]) => void;
			const controlledPromise = new Promise<(FileData & StringThumbnail)[]>(resolve => {
				resolvePromise = resolve;
			});
			mockedCreateThumbnails.mockReturnValue(controlledPromise);

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { result } = renderHook(() => useThumbnails(files));

			// Should be loading immediately after files are provided
			await waitFor(() => {
				expect(result.current.isLoading).toBe(true);
			});

			// Resolve the promise
			await act(async () => {
				resolvePromise(createMockThumbnails(files));
			});

			// Should no longer be loading
			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
			});
		});
	});

	describe('successful thumbnail generation', () => {
		it('should return thumbnails after successful generation', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			const mockThumbnails = createMockThumbnails(files);
			mockedCreateThumbnails.mockResolvedValue(mockThumbnails);

			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
				expect(result.current.thumbnails).toEqual(mockThumbnails);
				expect(result.current.error).toBeNull();
			});
		});

		it('should preserve additional properties on file objects', async () => {
			const files = [{ file: 'test.pdf', customProp: 'value' }];
			const mockThumbnails = createMockThumbnails(files);
			mockedCreateThumbnails.mockResolvedValue(mockThumbnails);

			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.thumbnails[0].customProp).toBe('value');
			});
		});

		it('should handle multiple files', async () => {
			const files: FileData[] = [
				{ file: 'file1.pdf' },
				{ file: 'file2.pdf' },
				{ file: 'file3.pdf' }
			];
			const mockThumbnails = createMockThumbnails(files);
			mockedCreateThumbnails.mockResolvedValue(mockThumbnails);

			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.thumbnails).toHaveLength(3);
			});
		});
	});

	describe('error handling', () => {
		it('should set error state when createThumbnails rejects', async () => {
			const testError = new Error('Failed to generate thumbnails');
			mockedCreateThumbnails.mockRejectedValue(testError);

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
				expect(result.current.error).toEqual(testError);
			});
		});

		it('should populate error state from ErrorThumbnail results', async () => {
			const files: FileData[] = [{ file: 'good.pdf' }, { file: 'bad.pdf' }];
			const mixedResults: (FileData & (StringThumbnail | ErrorThumbnail))[] = [
				{ file: 'good.pdf', thumbType: 'string', thumbData: 'data:image/png;base64,mock' },
				{ file: 'bad.pdf', thumbType: 'error', thumbData: 'PDF has no pages' },
			];
			mockedCreateThumbnails.mockResolvedValue(mixedResults);

			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
				expect(result.current.thumbnails).toHaveLength(1);
				expect(result.current.thumbnails[0].file).toBe('good.pdf');
				expect(result.current.error).toBeInstanceOf(Error);
				expect(result.current.error?.message).toContain('bad.pdf');
				expect(result.current.error?.message).toContain('PDF has no pages');
			});
		});

		it('should convert non-Error rejections to Error objects', async () => {
			mockedCreateThumbnails.mockRejectedValue('String error message');

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { result } = renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(result.current.error).toBeInstanceOf(Error);
				expect(result.current.error?.message).toBe('String error message');
			});
		});
	});

	describe('empty files array', () => {
		it('should not call createThumbnails for empty files array', async () => {
			const { result } = renderHook(() => useThumbnails([]));

			// Give time for any async operations
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockedCreateThumbnails).not.toHaveBeenCalled();
			expect(result.current.thumbnails).toEqual([]);
			expect(result.current.isLoading).toBe(false);
		});

		it('should reset state when files array becomes empty', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			const mockThumbnails = createMockThumbnails(files);
			mockedCreateThumbnails.mockResolvedValue(mockThumbnails);

			const { result, rerender } = renderHook(
				({ files }) => useThumbnails(files),
				{ initialProps: { files } }
			);

			await waitFor(() => {
				expect(result.current.thumbnails).toHaveLength(1);
			});

			// Rerender with empty files
			rerender({ files: [] });

			await waitFor(() => {
				expect(result.current.thumbnails).toEqual([]);
				expect(result.current.isLoading).toBe(false);
				expect(result.current.error).toBeNull();
			});
		});
	});

	describe('options handling', () => {
		it('should pass prefix option to createThumbnails', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			mockedCreateThumbnails.mockResolvedValue(createMockThumbnails(files));

			renderHook(() => useThumbnails(files, { prefix: '/api/files/' }));

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledWith(
					files,
					expect.objectContaining({ prefix: '/api/files/' })
				);
			});
		});

		it('should pass scale option to createThumbnails', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			mockedCreateThumbnails.mockResolvedValue(createMockThumbnails(files));

			renderHook(() => useThumbnails(files, { scale: 2 }));

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledWith(
					files,
					expect.objectContaining({ scale: 2 })
				);
			});
		});

		it('should pass page option to createThumbnails', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			mockedCreateThumbnails.mockResolvedValue(createMockThumbnails(files));

			renderHook(() => useThumbnails(files, { page: 3 }));

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledWith(
					files,
					expect.objectContaining({ page: 3 })
				);
			});
		});

		it('should pass AbortSignal to createThumbnails', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			mockedCreateThumbnails.mockResolvedValue(createMockThumbnails(files));

			renderHook(() => useThumbnails(files));

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledWith(
					files,
					expect.objectContaining({ signal: expect.any(AbortSignal) })
				);
			});
		});
	});

	describe('cleanup and cancellation', () => {
		it('should abort operation on unmount', async () => {
			let capturedSignal: AbortSignal | undefined;
			let resolvePromise: () => void;

			const controlledPromise = new Promise<(FileData & StringThumbnail)[]>(resolve => {
				resolvePromise = () => resolve([]);
			});

			mockedCreateThumbnails.mockImplementation(async (_files, options) => {
				capturedSignal = options?.signal;
				return controlledPromise;
			});

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { unmount } = renderHook(() => useThumbnails(files));

			// Wait for the hook to start the operation
			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalled();
			});

			// Unmount should trigger abort
			unmount();

			expect(capturedSignal?.aborted).toBe(true);

			// Clean up the promise
			resolvePromise!();
		});

		it('should not update state after unmount (success)', async () => {
			let resolvePromise: (value: (FileData & StringThumbnail)[]) => void;
			const controlledPromise = new Promise<(FileData & StringThumbnail)[]>(resolve => {
				resolvePromise = resolve;
			});
			mockedCreateThumbnails.mockReturnValue(controlledPromise);

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { result, unmount } = renderHook(() => useThumbnails(files));

			// Wait for loading to start
			await waitFor(() => {
				expect(result.current.isLoading).toBe(true);
			});

			// Unmount before resolution
			unmount();

			// Resolve after unmount - should not cause errors
			await act(async () => {
				resolvePromise!(createMockThumbnails(files));
			});

			// If we got here without errors, the test passes
		});

		it('should not update state after unmount (error)', async () => {
			let rejectPromise: (error: Error) => void;
			const controlledPromise = new Promise<(FileData & StringThumbnail)[]>((_, reject) => {
				rejectPromise = reject;
			});
			mockedCreateThumbnails.mockReturnValue(controlledPromise);

			const files: FileData[] = [{ file: 'test.pdf' }];
			const { result, unmount } = renderHook(() => useThumbnails(files));

			// Wait for loading to start
			await waitFor(() => {
				expect(result.current.isLoading).toBe(true);
			});

			// Unmount before rejection
			unmount();

			// Reject after unmount - should not cause errors
			await act(async () => {
				rejectPromise!(new Error('Test error'));
			});

			// If we got here without errors, the test passes
		});
	});

	describe('reactivity', () => {
		it('should refetch when files array changes', async () => {
			const files1: FileData[] = [{ file: 'file1.pdf' }];
			const files2: FileData[] = [{ file: 'file2.pdf' }];

			mockedCreateThumbnails
				.mockResolvedValueOnce(createMockThumbnails(files1))
				.mockResolvedValueOnce(createMockThumbnails(files2));

			const { result, rerender } = renderHook(
				({ files }) => useThumbnails(files),
				{ initialProps: { files: files1 } }
			);

			await waitFor(() => {
				expect(result.current.thumbnails[0].file).toBe('file1.pdf');
			});

			// Rerender with different files
			rerender({ files: files2 });

			await waitFor(() => {
				expect(result.current.thumbnails[0].file).toBe('file2.pdf');
			});

			expect(mockedCreateThumbnails).toHaveBeenCalledTimes(2);
		});

		it('should refetch when options change', async () => {
			const files: FileData[] = [{ file: 'test.pdf' }];
			mockedCreateThumbnails.mockResolvedValue(createMockThumbnails(files));

			const { rerender } = renderHook(
				({ options }) => useThumbnails(files, options),
				{ initialProps: { options: { scale: 1 } } }
			);

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledTimes(1);
			});

			// Change scale option
			rerender({ options: { scale: 2 } });

			await waitFor(() => {
				expect(mockedCreateThumbnails).toHaveBeenCalledTimes(2);
			});
		});
	});
});
