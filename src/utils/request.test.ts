import { describe, expect, it } from 'vitest';
import { copyRequest } from './request';
import { defaultUrl } from '../../test/utils';

describe('Request helpers', () => {
	describe(copyRequest.name, () => {
		it('Should copy request and its data', async () => {
			const initial = new Request(defaultUrl('/path'), {
				method: 'POST',
				body: '{"key": "value"}',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			const copy = copyRequest(initial);

			expect(copy.method).toBe('POST');
			expect(copy.url).toBe(defaultUrl('/path'));
			expect(copy.text()).resolves.toBe('{"key": "value"}');
			expect(copy.headers.get('content-type')).toBe('application/json');
		});

		it('Should copy request without modifying the initial one', () => {
			const initial = new Request(defaultUrl());
			const headerName = 'some-header';

			const copy = copyRequest(initial, { headers: { [headerName]: 'value' } });

			expect(initial.headers.get(headerName)).toBe(null);
			expect(copy.headers.get(headerName)).toBe('value');

			copy.headers.set(headerName, 'new-value');

			expect(initial.headers.get(headerName)).toBe(null);
			expect(copy.headers.get(headerName)).toBe('new-value');
		});
	});
});
