import { describe, expect, it, vi } from 'vitest';
import { connect } from '../../src/connect';
import { jsonResponse, textResponse } from '../../src/utils/response';
import { defaultUrl, delay } from '../utils';

describe('resolved-order mode', () => {
	it('Resolves as soon as one MW returns response', async () => {
		const request = new Request(defaultUrl());

		const [mw1Cb, mw3Cb, mw5Cb] = Array.from({ length: 3 }).map(_ => vi.fn());

		const start = Date.now();

		const response = await connect(
			request, //
			req => textResponse(`Hello from responder`),
			[
				[
					'resolved-order', //
					req => delay(500, () => mw1Cb),
					req => delay(400, new Response('MW 2')),
					req => delay(300, () => mw3Cb),
					req => delay(200, new Response('MW 4')),
					req => delay(100, () => mw5Cb),
					req => delay(1000, () => {}),
				],
			]
		);

		const end = Date.now();

		// because MW 4 was the fastest to return a response
		expect(await response.text()).toBe('MW 4');

		// we received the response after 200ms (once one MW returned response)
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(190); // lower duration to adjust for timer inaccuracies
		expect(duration).lessThan(300);

		// only callbacks of MWs which resolved before MW 4 will be called
		expect(mw1Cb).not.toBeCalled();
		expect(mw3Cb).not.toBeCalled();
		expect(mw5Cb).toBeCalled();
	});

	it('Applies request modifications in the same order as MWs resolve', async () => {
		const request = new Request(defaultUrl());

		const response = await connect(
			request, //
			req => textResponse(req.headers.get('some-header') || ''),
			[
				[
					'resolved-order', //
					req => delay(500, () => req.headers.append('some-header', 'MW 1')),
					req => delay(100, () => req.headers.append('some-header', 'MW 2')),
				],
			]
		);

		// responder extracts the some-header and returns it as a response
		// MW 2 resolved first so its modifications will also be applied first
		await expect(response.text()).resolves.toEqual('MW 2, MW 1');
	});
});

describe('defined-order mode', () => {
	it('Resolves as soon as one MW returns response and all previously defined MWs also resoled ', async () => {
		const request = new Request(defaultUrl());

		const [mw1Cb, mw3Cb, mw5Cb] = Array.from({ length: 3 }).map(_ => vi.fn());

		const start = Date.now();

		const response = await connect(
			request, //
			req => textResponse(`Hello from responder`),
			[
				[
					'defined-order', //
					req => delay(500, () => mw1Cb),
					req => delay(400, new Response('MW 2')),
					req => delay(300, () => mw3Cb),
					req => delay(200, new Response('MW 4')),
					req => delay(100, () => mw5Cb),
					req => delay(1000, () => {}),
				],
			]
		);

		const end = Date.now();

		// because MW 2 was registered before MW 4 even though it resolved later
		expect(await response.text()).toBe('MW 2');

		// we received the response after 500ms (once the slowest MW resolved)
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(490); // lower duration to adjust for timer inaccuracies
		expect(duration).lessThan(600);

		// only callbacks of MWs registered before MW1 will be called
		expect(mw1Cb).toBeCalled();
		expect(mw3Cb).not.toBeCalled();
		expect(mw5Cb).not.toBeCalled();
	});

	it('Applies request modifications in the same order as MWs were defined', async () => {
		const request = new Request(defaultUrl());

		const response = await connect(
			request, //
			req => textResponse(req.headers.get('some-header') || ''),
			[
				[
					'defined-order', //
					req => delay(500, () => req.headers.append('some-header', 'MW 1')),
					req => delay(100, () => req.headers.append('some-header', 'MW 2')),
				],
			]
		);

		// responder extracted the some-header and returned it as response
		// MW 1 resolved last but it was registered before MW 2 so its modifications will also be applied first
		await expect(response.text()).resolves.toEqual('MW 1, MW 2');
	});
});

it('Combination of all modes together works', async () => {
	const request = new Request(defaultUrl());

	const response = await connect(
		request, //
		req => jsonResponse(req.headers.get('some-header')?.split(', ') || []),
		[
			req => req.headers.append('some-header', 'MW 1'),
			[
				'resolved-order', //
				req => delay(100, () => req.headers.append('some-header', 'MW 2')),
				req => req.headers.append('some-header', 'MW 3'),
			],
			req => req.headers.append('some-header', 'MW 4'),
			[
				'defined-order', //
				req => delay(100, () => req.headers.append('some-header', 'MW 5')),
				req => req.headers.append('some-header', 'MW 6'),
			],
			req => req.headers.append('some-header', 'MW 7'),
		]
	);

	// Responder extracted the some-header and returned it as array
	await expect(response.json()).resolves.toEqual([
		// chain
		'MW 1',
		// resolved-order
		'MW 3', // MW 3 resolved first
		'MW 2',
		// chain
		'MW 4',
		// defined-order
		'MW 5', // MW 5 resolved later, but was registered first
		'MW 6',
		// chain
		'MW 7',
	]);
});
