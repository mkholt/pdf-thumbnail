import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, type LogLevel } from "../../src/lib/logging.js";

describe("Logging", () => {
	const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("createLogger with 'silent' level", () => {
		test("debug does not log", () => {
			const log = createLogger("silent");
			log.debug("test message");
			expect(debugSpy).not.toHaveBeenCalled();
		});

		test("error does not log", () => {
			const log = createLogger("silent");
			log.error("test error");
			expect(errorSpy).not.toHaveBeenCalled();
		});
	});

	describe("createLogger with 'error' level", () => {
		test("debug does not log", () => {
			const log = createLogger("error");
			log.debug("test message");
			expect(debugSpy).not.toHaveBeenCalled();
		});

		test("error logs with [PDF] prefix", () => {
			const log = createLogger("error");
			log.error("test error", { detail: "info" });
			expect(errorSpy).toHaveBeenCalledWith("[PDF]", "test error", { detail: "info" });
		});
	});

	describe("createLogger with 'debug' level", () => {
		test("debug logs with [PDF] prefix", () => {
			const log = createLogger("debug");
			log.debug("test message", 123);
			expect(debugSpy).toHaveBeenCalledWith("[PDF]", "test message", 123);
		});

		test("error logs with [PDF] prefix", () => {
			const log = createLogger("debug");
			log.error("test error");
			expect(errorSpy).toHaveBeenCalledWith("[PDF]", "test error");
		});
	});

	describe("Logger type coverage", () => {
		test("logger has debug and error methods", () => {
			const log = createLogger("debug");
			expect(typeof log.debug).toBe("function");
			expect(typeof log.error).toBe("function");
		});

		test("all log levels are valid", () => {
			const levels: LogLevel[] = ["silent", "error", "debug"];
			levels.forEach(level => {
				const log = createLogger(level);
				expect(log).toBeDefined();
				expect(log.debug).toBeDefined();
				expect(log.error).toBeDefined();
			});
		});
	});
});
