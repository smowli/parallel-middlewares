import { MiddlewareInvalidReturnError, ParallelMiddlewareReplaceRequestError } from './errors';
import { RequestRecorder, createRequestRecorder } from './recorder';
import {
	Middleware,
	MiddlewareCallback,
	MiddlewareContext,
	MiddlewareResponse,
	ParallelExecutionType,
	Responder,
} from './types';

const isMiddlewareResponse = (input: unknown): input is MiddlewareResponse => {
	const validValues = [
		(i: typeof input) => i === undefined,
		(i: typeof input) => i instanceof Response,
		(i: typeof input) => i instanceof Request,
		(i: typeof input) => typeof i === 'function',
		(i: typeof input) => Array.isArray(i) && i[0] instanceof Request && typeof i[1] === 'function',
	];

	return validValues.some(check => check(input));
};

/** Kind of a "sandbox" for the MW so we can control what happens */
const executeMiddleware = async (MW: () => any, options: { parallel: boolean }) => {
	let result = await MW();

	if (options.parallel && result instanceof Request) {
		throw new ParallelMiddlewareReplaceRequestError();
	}

	if (!isMiddlewareResponse(result)) {
		throw new MiddlewareInvalidReturnError(result);
	}

	return result;
};

/*
	This function essentially executes middlewares and combines their results.
	If parallel execution is configured, the MWs are started in parallel each working with the initial request object.
	Then the modifications made by each MW are replayed to single output request object as if they were executed in series.
*/

export const connect = async <Context extends MiddlewareContext = MiddlewareContext>(
	request: Request,
	responder: Responder<Context>,
	middlewares: Array<Middleware<Context> | [ParallelExecutionType, ...Middleware<Context>[]]>,
	context?: Context
): Promise<Response> => {
	const ctx = context || ({} as Context);

	type ExecutionResult = [RequestRecorder, MiddlewareResponse<Context>];

	if (middlewares?.length) {
		const callbacks: Array<MiddlewareCallback<Context>> = [];
		let response: Response | undefined = undefined;
		let finalRequest = request.clone();

		// Label the main loop so it's easier to break the loop
		MIDDLEWARE_LOOP: for (const MWs of middlewares) {
			let executionResults: ExecutionResult[] = [];

			if (!Array.isArray(MWs)) {
				// Serial MWs
				const recorder = createRequestRecorder(finalRequest);

				const result = await executeMiddleware(() => MWs(recorder.proxy, ctx, {}), {
					parallel: false,
				});

				executionResults = [[recorder, result]];
			} else {
				// Parallel MWs
				const [executionType, ...parallelMiddlewares] = MWs;

				switch (executionType) {
					case 'resolved-order': {
						executionResults = await new Promise((resolve, reject) => {
							const controllers: Array<AbortController | undefined> = Array.from({
								length: parallelMiddlewares.length,
							}).map(_ => new AbortController());

							const results: typeof executionResults = [];

							Promise.all(
								parallelMiddlewares.map(async (MW, index) => {
									try {
										const recorder = createRequestRecorder(finalRequest);

										const result = await executeMiddleware(
											() => MW(recorder.proxy, ctx, { abortSignal: controllers[index]?.signal }),
											{ parallel: true }
										);

										controllers[index] = undefined; // Promise resolved - delete abort controller so it won't be called anymore
										results.push([recorder, result]);

										const shouldAbort = result instanceof Response;

										if (shouldAbort) {
											// Send abort signal to remaining pending MWs
											controllers.forEach(controller => {
												if (controller instanceof AbortController) controller.abort();
											});

											resolve(results);
										}
									} catch (error) {
										reject(error);
									}
								})
							)
								.then(() => resolve(results))
								.catch(reject);
						});
						break;
					}
					case 'defined-order': {
						executionResults = await new Promise((resolve, reject) => {
							const controllers: Array<AbortController | undefined> = Array.from({
								length: parallelMiddlewares.length,
							}).map(_ => new AbortController());

							const results: typeof executionResults = Array.from({
								length: parallelMiddlewares.length,
							});

							Promise.all(
								parallelMiddlewares.map(async (MW, index) => {
									try {
										const recorder = createRequestRecorder(finalRequest);

										const result = await executeMiddleware(
											() => MW(recorder.proxy, ctx, { abortSignal: controllers[index]?.signal }),
											{ parallel: true }
										);

										controllers[index] = undefined;
										results[index] = [recorder, result];

										const responseIndex = results.findIndex(
											result => Array.isArray(result) && result[1] instanceof Response
										);

										const isEveryItemResolvedToResponseIndex = results
											.slice(0, responseIndex === -1 ? undefined : responseIndex)
											.every(result => Array.isArray(result));

										const shouldAbort = isEveryItemResolvedToResponseIndex;

										if (shouldAbort) {
											// Send abort signal to remaining pending MWs
											controllers.forEach(controller => {
												if (controller instanceof AbortController) controller.abort();
											});

											if (responseIndex !== -1) results.length = responseIndex + 1;

											resolve(results);
										}
									} catch (error) {
										reject(error);
									}
								})
							)
								.then(() => resolve(results))
								.catch(reject);
						});
						break;
					}
					default: {
						throw new Error(`Unsupported execution type "${executionType}"`);
					}
				}
			}

			// Combine results
			for (let index = 0; index < executionResults.length; index++) {
				const [recorder, result] = executionResults[index];

				if (result instanceof Response) {
					response = result;
					break;
				}

				if (result instanceof Request) {
					finalRequest = result;
					continue;
				}

				if (Array.isArray(result)) {
					finalRequest = result[0];
					callbacks.push(result[1]);
					continue;
				}

				if (typeof result === 'function') {
					callbacks.push(result);
				}

				finalRequest = recorder.replayOnRequest(finalRequest);
			}

			// If one MW in the chain returned response, stop processing the remaining results
			if (response) break MIDDLEWARE_LOOP;
		}

		if (!response) {
			// If MW already returned response, skip the responder and move to callbacks
			response = await responder(finalRequest.clone(), ctx);
		}

		/*
		 Call the callbacks in the opposite order of how MWs were registered
		 MW1 -> MW2 -> Responder -> MW2 Callback -> MW1 Callback
		*/
		const callbacksLIFO = [...callbacks].reverse();

		// Callbacks have an option to modify/alter the Response
		let possiblyAlteredResponse = response;

		for (const callback of callbacksLIFO) {
			const cbResult = await callback(possiblyAlteredResponse, ctx);

			if (cbResult instanceof Response) {
				// Callback possibly altered the response
				possiblyAlteredResponse = cbResult;
			}
		}

		return possiblyAlteredResponse;
	}

	return responder(request, ctx);
};
