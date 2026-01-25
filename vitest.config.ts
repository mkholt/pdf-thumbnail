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
		setupFiles: ['tests/setup.http.ts'],
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					include: ['tests/**/*.test.ts'],
					environment: 'node'
				}
			},
			{
				extends: true,
				test: {
					name: 'jsdom',
					include: ['tests/**/*.test.tsx'],
					environment: 'jsdom'
				}
			}
		]
	}
})
