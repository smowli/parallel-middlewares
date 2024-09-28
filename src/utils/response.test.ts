import { describe, expect, it } from 'vitest';
import { copyResponse, jsonResponse, redirectResponse, textResponse } from './response';

describe('Response helpers', () => {
	describe(copyResponse.name, () => {
		it('Should copy response and its data', async () => {
			const initial = new Response('Hello', { status: 400, statusText: 'Random' });

			const copy = copyResponse(initial);

			expect(copy.status).toBe(400);
			expect(copy.statusText).toBe('Random');
			expect(copy.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
			await expect(copy.text()).resolves.toBe('Hello');
		});

		it('Should copy response without modifying the initial one', () => {
			const initial = new Response('Hello', { status: 400, statusText: 'Random' });
			const headerName = 'some-header';

			const copy = copyResponse(initial, { headers: { [headerName]: 'value' } });

			expect(initial.headers.get(headerName)).toBe(null);
			expect(copy.headers.get(headerName)).toBe('value');

			copy.headers.set(headerName, 'new-value');

			expect(initial.headers.get(headerName)).toBe(null);
			expect(copy.headers.get(headerName)).toBe('new-value');
		});
	});

	describe(jsonResponse.name, () => {
		it('Should have the correct content type and body', () => {
			const response = jsonResponse({ fistName: 'a', lastName: 'b' });

			expect(response.json()).resolves.toMatchObject({ fistName: 'a', lastName: 'b' });
			expect(response.headers.get('content-type')).toBe('application/json');
		});

		it('Should allow modification of the response', () => {
			const response = jsonResponse({}, { headers: { 'some-header': 'value' } });

			expect(response.headers.get('some-header')).toBe('value');
		});
	});

	describe(textResponse.name, () => {
		it('Should have the correct content type and body', () => {
			const response = textResponse('Hello response');

			expect(response.text()).resolves.toBe('Hello response');
			expect(response.headers.get('content-type')).toBe('text/plain');
		});

		it('Should allow modification of the response', () => {
			const response = textResponse('', { headers: { 'some-header': 'value' } });

			expect(response.headers.get('some-header')).toBe('value');
		});
	});

	describe(redirectResponse.name, () => {
		it('Should return the correct response data', () => {
			const response1 = redirectResponse('https://localhost/temporary', 302);
			const response2 = redirectResponse('https://localhost/permanent', 301);

			expect(response1.status).toBe(302);
			expect(response1.headers.get('location')).toBe('https://localhost/temporary');

			expect(response2.status).toBe(301);
			expect(response2.headers.get('location')).toBe('https://localhost/permanent');
		});
	});
});
