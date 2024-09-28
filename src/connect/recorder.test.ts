import { describe, expect, it } from 'vitest';
import { createRequestRecorder } from '../../src/connect/recorder';
import { defaultUrl } from '../../test/utils';

describe('Recorder', () => {
	describe(createRequestRecorder.name, () => {
		it('Should record header changes, isolate the initial request from being mutated and replay the request modifications', () => {
			const baseRequest = new Request(defaultUrl(), {
				headers: { authorization: '123' },
			});

			const recorder = createRequestRecorder(baseRequest);
			const request = recorder.proxy;

			request.headers.set('a', 'value1');
			request.headers.append('a', 'value2');
			request.headers.append('b', 'value1');
			request.headers.set('authorization', 'jwt');
			request.headers.delete('b');

			const finalRequest = recorder.replayOnRequest(new Request(defaultUrl()));

			expect([...baseRequest.headers.entries()]).toEqual([['authorization', '123']]);

			expect([...request.headers.entries()]).toEqual([
				['a', 'value1, value2'],
				['authorization', 'jwt'],
			]);

			expect([...finalRequest.headers.entries()]).toEqual([
				['a', 'value1, value2'],
				['authorization', 'jwt'],
			]);
		});
	});
});
