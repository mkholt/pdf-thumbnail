export type LogLevel = "silent" | "error" | "debug";

export type Logger = {
	debug: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

export function createLogger(level: LogLevel): Logger {
	return {
		debug: (...args) => level === "debug" && console.debug("[PDF]", ...args),
		error: (...args) => level !== "silent" && console.error("[PDF]", ...args),
	};
}
