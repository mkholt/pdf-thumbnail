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

## Usage

```typescript
import { useThumbnails, FileData } from '@mkholt/pdf-thumbnail'

export type Data = FileData & { name: string }
export type ThumbnailsProps = {
	files: Data[]
}
export const Thumbnails = ({ files }: ThumbnailsProps) => {
	const thumbs = useThumbnails(files)

	return (
		<div>
			{thumbs.map(td => (
				<a key={td.file} href={`/files/${td.file}`} target="_blank">
					<img src={d.thumbData} alt={td.name} />
				</a>
			))}
		</div>
	)
}
```

## Features

- Generate thumbnails from PDF documents
- Easy to use API
- Supports outputting directly to a data URL or Buffer

## Contributing

Contributions are welcome! Please open a PR for suggestions.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
