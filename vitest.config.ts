import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	test: {
		silent: true,
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts','src/**/*.tsx'],
			exclude: ['src/**/index.ts']
		},
		environmentMatchGlobs: [
			['tests/**/*.tsx', 'jsdom']
		],
		setupFiles: ['tests/setup.http.ts']
	}
})
