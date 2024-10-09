export type Thumbnail = {
	thumbData: string
}

export function isThumbnailArray(data: unknown[]): data is Thumbnail[] {
	return Array.isArray(data) && data.every(isThumbnail);
}

export function isThumbnail(data: unknown): data is Thumbnail {
	return typeof data === "object" && (data as Thumbnail).thumbData !== undefined;
}