import { describe, expect, it } from 'vitest';
import { extractHeaders, mergeHeaders } from './headers';

describe('Headers', () => {
	describe(extractHeaders.name, () => {
		it('Should extract only specified headers', () => {
			const headers = new Headers({
				'authorization': 'a',
				'x-custom': 'b',
				'content-type': 'c',
				'x-forwarder-for': 'd',
			});

			headers.append('set-cookie', 'cookie1=e1');
			headers.append('set-cookie', 'cookie2=e2');
			// Check if the same cookie is set only once
			headers.append('set-cookie', 'cookie2=e3');

			const result = extractHeaders(
				['authorization', 'x-custom', 'set-cookie', 'does-not-exist'],
				headers
			);

			expect([...result.entries()]).toEqual(
				expect.arrayContaining([
					['authorization', 'a'],
					['set-cookie', 'cookie1=e1'],
					['set-cookie', 'cookie2=e3'],
					['x-custom', 'b'],
				])
			);
		});
	});

	describe(mergeHeaders.name, () => {
		it('Should merge headers', () => {
			const headers1 = new Headers();

			headers1.set('x-a', 'a');
			headers1.set('x-b', 'b');
			headers1.set('x-c', 'c-v1');

			const headers2 = new Headers();

			headers2.set('x-d', 'd');
			headers2.set('x-c', 'c-v2');
			headers2.append('set-cookie', 'cookie1=v1');
			headers2.append('set-cookie', 'cookie2=v1');

			const headers3 = new Headers();

			headers3.set('content-type', 'text/plain');
			headers3.set('x-c', 'c-v3');
			headers3.append('set-cookie', 'cookie2=v2');

			const result = mergeHeaders([headers1, headers2, headers3]);

			expect([...result.entries()]).toEqual([
				['content-type', 'text/plain'],
				['set-cookie', 'cookie1=v1'],
				['set-cookie', 'cookie2=v2'],
				['x-a', 'a'],
				['x-b', 'b'],
				['x-c', 'c-v3'],
				['x-d', 'd'],
			]);
		});

		it('Should support object as input', () => {
			const headers1 = new Headers();

			headers1.set('authorization', 'a');
			headers1.set('x-a', 'value1');
			headers1.set('x-delete', 'value1');

			const result = mergeHeaders([
				headers1,
				{
					'x-a': 'value2',
					'x-b': 'value1',
				},
				{
					'x-delete': null,
					'set-cookie': 'cookie1=value',
				},
			]);

			expect([...result.entries()]).toEqual([
				['authorization', 'a'],
				['set-cookie', 'cookie1=value'],
				['x-a', 'value2'],
				['x-b', 'value1'],
			]);
		});
	});
});
