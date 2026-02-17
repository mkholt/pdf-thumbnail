export type Thumbnail = StringThumbnail | BufferThumbnail | ErrorThumbnail;

export type StringThumbnail = {
	thumbType: "string"
	thumbData: string
}

export type BufferThumbnail = {
	thumbType: "buffer"
	thumbData: Buffer;
}

export type ErrorThumbnail = {
	thumbType: "error"
	thumbData: string
}
