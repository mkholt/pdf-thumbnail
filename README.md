# PDF Thumbnail Library

[![npm](https://img.shields.io/npm/v/pdf-thumbnail)](https://www.npmjs.com/@mkholt/pdf-thumbnail)
[![codecov](https://img.shields.io/codecov/c/github/mkholt/pdf-thumbnail)](https://app.codecov.io/github/mkholt/pdf-thumbnail)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Overview

The PDF Thumbnail Library is a tool to generate thumbnails from PDF documents. It is designed to be simple and efficient, making it easy to integrate into your projects.

The library exposes methods to directly generate the thumbnail into a data url string, or a Buffer.

## Installation

NPM:
```bash
npm install @mkholt/pdf-thumbnail
```

Yarn:
```bash
yarn add @mkholt/pdf-thumbnail
```

If you are running in node, `node-canvas` is a peer dependency, install it:

NPM:
```bash
npm install canvas@3
```

Yarn:
```bash
yarn add canvas@3
```

## Usage

### Embedded client-side as thumbnail images

```typescript
import { useThumbnails, FileData } from '@mkholt/pdf-thumbnail'

export type Data = FileData & { name: string }
export type ThumbnailsProps = {
	files: Data[]
}
export const Thumbnails = ({ files }: ThumbnailsProps) => {
	const { thumbnails, isLoading, error } = useThumbnails(files)

	if (isLoading) return <div>Loading thumbnails...</div>
	if (error) return <div>Error: {error.message}</div>

	return (
		<div>
			{thumbnails.map(td => (
				<a key={td.file} href={`/files/${td.file}`} target="_blank">
					<img src={td.thumbData} alt={td.name} />
				</a>
			))}
		</div>
	)
}
```

### Embedded server-side by building images using node

```typescript
import { PageContext } from "vike/types";
import { createThumbnails } from "@mkholt/pdf-thumbnail";

export type Data = Awaited<ReturnType<typeof data>>
export async function data(pageContext: PageContext) {
	const { id } = pageContext.routeParams
	const pageData = await import(`../../../data/${id}.mdx`) as MDXDocument<InfoPage>
	const thumbnails = await createThumbnails(pageData.config.links ?? [], 'public/files/')

	return {
		pageId: id,
		pageConfig: unit.config,
		thumbnails
	}
}

```

## Features

- Generate thumbnails from PDF documents
- Easy to use API
- Supports outputting directly to a data URL or Buffer
- Customizable scale and page selection
- Progress callback for batch operations
- AbortSignal support for cancellation
- React hook with loading/error state

## API

### `createThumbnail(file, options?)`

Creates a thumbnail for a single PDF file.

```typescript
const thumb = await createThumbnail("path/to/file.pdf", {
	output: "string",  // "string" (default) or "buffer"
	scale: 1,          // Scale factor (default: 1)
	page: 1,           // Page number (default: 1)
	signal: abortController.signal,  // Optional AbortSignal
	logLevel: "error", // "silent" | "error" | "debug"
});
```

### `createThumbnails(files, options?)`

Creates thumbnails for multiple files.

```typescript
const thumbs = await createThumbnails(files, {
	prefix: "public/",  // Prefix for file paths
	scale: 0.5,         // Scale factor
	page: 1,            // Page number
	signal: abortController.signal,
	onProgress: (completed, total) => {
		console.log(`Progress: ${completed}/${total}`);
	}
});
```

### `useThumbnails(files, options?)` (React Hook)

React hook for client-side thumbnail generation.

```typescript
const { thumbnails, isLoading, error } = useThumbnails(files, {
	prefix: "/api/files/",
	scale: 1,
	page: 1,
});
```

## Migration from v1 to v2

### Breaking Change: `useThumbnails` return type

In v1, `useThumbnails` returned an array of thumbnails directly:

```typescript
// v1
const thumbnails = useThumbnails(files);
```

In v2, it returns an object with `thumbnails`, `isLoading`, and `error`:

```typescript
// v2
const { thumbnails, isLoading, error } = useThumbnails(files);
```

## Contributing

Contributions are welcome! Please open a PR for suggestions.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
