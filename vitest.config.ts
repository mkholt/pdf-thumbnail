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
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					include: ['tests/**/*.test.ts'],
					environment: 'node',
					setupFiles: ['tests/setup.http.ts']
				}
			},
			{
				extends: true,
				test: {
					name: 'jsdom',
					include: ['tests/**/*.test.tsx'],
					environment: 'jsdom',
					setupFiles: ['tests/setup.http.ts', 'tests/setup.jsdom.ts']
				}
			}
		]
	}
})
