export type Thumbnail = StringThumbnail | BufferThumbnail;

export type StringThumbnail = {
	thumbType: "string"
	thumbData: string
}

export type BufferThumbnail = {
	thumbType: "buffer"
	thumbData: Buffer;
}
