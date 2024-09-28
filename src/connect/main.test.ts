import { describe, expect, it, vi } from 'vitest';
import { connect } from '../../src/connect';
import { copyResponse, textResponse } from '../utils/response';
import { defaultRequest, defaultUrl, delay } from '../../test/utils';

describe('Connect function for executing MWs', () => {
	const orderHeader = 'x-order';

	describe('Chained MWs', () => {
		it('Should apply MWs in the correct order and pass req & res objects correctly', async () => {
			const response = await connect(
				defaultRequest(),
				req => {
					req.headers.append(orderHeader, 'responder');
					return textResponse('Hello', {
						headers: {
							[orderHeader]: req.headers.get(orderHeader) || '',
							'x-mw': req.headers.get('x-mw') || '',
						},
					});
				},
				[
					req => {
						req.headers.append(orderHeader, 'req-1');
						return res => {
							const headers = new Headers(res.headers);
							headers.append(orderHeader, 'res-1');
							return copyResponse(res, { headers });
						};
					},
					req => req.headers.set('x-mw', 'MW'),
					req => {
						req.headers.append(orderHeader, 'req-2');
						return res => {
							const headers = new Headers(res.headers);
							headers.append(orderHeader, 'res-2');
							headers.set('x-some-header', 'some-header-value');
							return copyResponse(res, { headers });
						};
					},
				]
			);

			await expect(response.text()).resolves.toBe('Hello');

			expect(response.headers.get(orderHeader)?.split(', ')).toEqual([
				'req-1',
				'req-2',
				'responder',
				'res-2',
				'res-1',
			]);

			expect(response.headers.get('x-mw')).toBe('MW');
			expect(response.headers.get('x-some-header')).toBe('some-header-value');
		});

		it('Should abort remaining MWs when one returns Response', async () => {
			const [responder, lastMW] = Array.from({ length: 2 }).map(_ => vi.fn());

			const response = await connect(defaultRequest(), responder, [
				_ => new Response('MW 2'),
				lastMW,
			]);

			await expect(response.text()).resolves.toBe('MW 2');

			expect(lastMW).not.toBeCalled();
			expect(responder).not.toBeCalled();
		});
	});

	describe('Parallel MWs', () => {
		describe('"defined-order" execution method', () => {
			it('Should apply MWs in the correct order and pass req & res objects correctly', async () => {
				const response = await connect(
					defaultRequest(),
					req => {
						req.headers.append(orderHeader, 'responder');
						return textResponse('Hello', {
							headers: {
								[orderHeader]: req.headers.get(orderHeader) || '',
								'x-mw': req.headers.get('x-mw') || '',
							},
						});
					},
					[
						[
							'defined-order', //
							req => {
								req.headers.append(orderHeader, 'req-1');
								return res => {
									const headers = new Headers(res.headers);
									headers.append(orderHeader, 'res-1');
									return copyResponse(res, { headers });
								};
							},
							req => req.headers.set('x-mw', 'MW'),
							async req => {
								await delay(100);

								req.headers.append(orderHeader, 'req-2');
								return async res => {
									await delay(100);

									const headers = new Headers(res.headers);
									headers.append(orderHeader, 'res-2');
									headers.set('x-some-header', 'some-header-value');
									return copyResponse(res, { headers });
								};
							},
						],
					]
				);

				await expect(response.text()).resolves.toBe('Hello');

				expect(response.headers.get(orderHeader)?.split(', ')).toEqual([
					'req-1',
					'req-2',
					'responder',
					'res-2',
					'res-1',
				]);

				expect(response.headers.get('x-mw')).toBe('MW');
				expect(response.headers.get('x-some-header')).toBe('some-header-value');
			});

			it('Should abort remaining MWs when the one registered sooner returns Response', async () => {
				const [responder, mwCallback, lastMW] = Array.from({ length: 5 }).map(_ => vi.fn());

				const response = await connect(defaultRequest(), responder, [
					[
						'defined-order', //
						_ => delay(100, new Response('MW 1')),
						_ => new Response('MW 2'),
						_ => mwCallback,
					],
					lastMW,
				]);

				await delay(1000);

				await expect(response.text()).resolves.toBe('MW 1');

				expect(responder).not.toBeCalled();
				expect(mwCallback).not.toBeCalled();
				expect(lastMW).not.toBeCalled();
			});

			it('Should handle abort signal properly', async () => {
				const [responder, fastPromiseAbortHandler, slowPromiseAbortHandler] = Array.from({
					length: 3,
				}).map(_ => vi.fn());

				const response = await connect(defaultRequest(), responder, [
					[
						'defined-order', //
						_ => delay(200, new Response('MW 1')),
						async (_r, _c, { abortSignal }) => {
							abortSignal?.addEventListener('abort', fastPromiseAbortHandler);
							await delay(100);
						},
						async (_r, _c, { abortSignal }) => {
							abortSignal?.addEventListener('abort', slowPromiseAbortHandler);
							await delay(300);
						},
					],
				]);

				await delay(300);

				await expect(response.text()).resolves.toBe('MW 1');

				// abort should not be called for MWs that already resolved
				expect(fastPromiseAbortHandler).not.toBeCalled();
				expect(slowPromiseAbortHandler).toBeCalled();
			});

			it('Should throw error when parallel MWs try to replace Request object because it could lead to unexpected result', async () => {
				const [responder] = Array.from({ length: 1 }).map(_ => vi.fn());

				await expect(
					connect(defaultRequest(), responder, [
						[
							'defined-order',
							req => req.headers.set('x-header', 'value'),
							req => new Request(defaultUrl()),
						],
					])
				).rejects.toThrowError();

				expect(responder).not.toBeCalled();
			});
		});

		describe('"resolved-order" execution method', () => {
			it('Should apply MWs in the correct order and pass req & res objects correctly', async () => {
				const response = await connect(
					defaultRequest(),
					req => {
						req.headers.append(orderHeader, 'responder');
						return textResponse('Hello', {
							headers: {
								[orderHeader]: req.headers.get(orderHeader) || '',
								'x-mw': req.headers.get('x-mw') || '',
							},
						});
					},
					[
						[
							'resolved-order', //
							async req => {
								await delay(100);

								req.headers.append(orderHeader, 'req-1');
								return async res => {
									await delay(100);

									const headers = new Headers(res.headers);
									headers.append(orderHeader, 'res-1');
									return copyResponse(res, { headers });
								};
							},
							req => req.headers.set('x-mw', 'mw'),
							req => {
								req.headers.append(orderHeader, 'req-2');
								return res => {
									const headers = new Headers(res.headers);
									headers.append(orderHeader, 'res-2');
									headers.set('x-some-header', 'some-header-value');
									return copyResponse(res, { headers });
								};
							},
						],
					]
				);

				await expect(response.text()).resolves.toBe('Hello');

				expect(response.headers.get(orderHeader)?.split(', ')).toEqual([
					'req-2',
					'req-1',
					'responder',
					'res-1',
					'res-2',
				]);

				expect(response.headers.get('x-mw')).toBe('mw');
				expect(response.headers.get('x-some-header')).toBe('some-header-value');
			});

			it('Should abort remaining MWs when the first returns Response', async () => {
				const [responder, mwCallback, lastMW] = Array.from({ length: 3 }).map(_ => vi.fn());

				const response = await connect(defaultRequest(), responder, [
					[
						'resolved-order', //
						_ => delay(200, new Response('MW 1')),
						_ => delay(100, new Response('MW 2')),
						_ => mwCallback,
					],
					lastMW,
				]);

				await expect(response.text()).resolves.toBe('MW 2');

				// ! Callback should be called as this MWs resolved before the other ones
				expect(mwCallback).toBeCalled();

				expect(responder).not.toBeCalled();
				expect(lastMW).not.toBeCalled();
			});

			it('Should handle abort signal properly', async () => {
				const [responder, fastPromiseAbortHandler, slowPromiseAbortHandler] = Array.from({
					length: 3,
				}).map(_ => vi.fn());

				const response = await connect(defaultRequest(), responder, [
					[
						'resolved-order', //
						_ => delay(200, new Response('MW 1')),
						async (_r, _c, { abortSignal }) => {
							abortSignal?.addEventListener('abort', fastPromiseAbortHandler);
							await delay(100);
						},
						async (_r, _c, { abortSignal }) => {
							abortSignal?.addEventListener('abort', slowPromiseAbortHandler);
							await delay(300);
						},
					],
				]);

				await delay(300);

				await expect(response.text()).resolves.toBe('MW 1');

				// abort should not be called for MWs that already resolved
				expect(fastPromiseAbortHandler).not.toBeCalled();
				expect(slowPromiseAbortHandler).toBeCalled();
			});

			it('Should throw error when parallel MWs try to replace Request object because it could lead to unexpected result', async () => {
				const [responder] = Array.from({ length: 1 }).map(_ => vi.fn());

				await expect(
					connect(defaultRequest(), responder, [
						[
							'resolved-order',
							req => req.headers.set('x-header', 'value'),
							req => new Request(defaultUrl()),
						],
					])
				).rejects.toThrowError();

				expect(responder).not.toBeCalled();
			});
		});
	});
});
