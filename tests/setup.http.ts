import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import fs from "fs";
import { afterAll, beforeAll, afterEach } from "vitest";

const sampleData = fs.readFileSync('tests/samples/sample.pdf')

export const restHandlers = [
	http.get('http://localhost:3000/samples/:filename', () => {
		const sampleDataBuffer = new ArrayBuffer(sampleData.length)
		const sampleDataView = new Uint8Array(sampleDataBuffer)
		sampleDataView.set(sampleData)

		return HttpResponse.arrayBuffer(sampleDataBuffer, {
			headers: {
				'Content-Type': 'application/pdf'
			}
		})
	})
]

const server = setupServer(...restHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
