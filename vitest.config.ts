import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		silent: true,
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts','src/**/*.tsx'],
			exclude: ['src/**/index.ts']
		}
	}
})
