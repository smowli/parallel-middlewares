import { copyRequest } from '../utils/request';

type HeadersModification =
	| ['delete', string]
	| ['set', string, string]
	| ['append', string, string];

interface Modifications {
	headers: HeadersModification[];
}

export type RequestRecorder = ReturnType<typeof createRequestRecorder>;

/**
 * Provides js Proxy on the passed request object which internally records changes
 * made to this object so they can be later replayed on another request object.
 * ! Only header modifications are supported for now.
 */
export const createRequestRecorder = (inputRequest: Request) => {
	const modifications: Modifications = {
		headers: [],
	};

	const request = inputRequest.clone();

	const headersRecorder = createHeadersRecorder(request.headers, modifications);

	return {
		modifications,
		proxy: new Proxy(request, {
			get(target, propKey) {
				switch (propKey) {
					case 'headers':
						return headersRecorder;
				}

				return Reflect.get(target, propKey);
			},
		}),
		replayOnRequest: (request: Request) => {
			const headers = new Headers(request.headers);

			modifications.headers.forEach(([operation, ...args]) => {
				// @ts-ignore (we have union of tuples based on function signature and TS does not know)
				headers[operation](...args);
			});

			return copyRequest(request, { headers });
		},
	};
};

export const createHeadersRecorder = (inputHeaders: Headers, modifications: Modifications) => {
	const headers = new Headers(inputHeaders);

	return new Proxy(headers, {
		get(headers, propKey) {
			// @ts-ignore (Headers don't have index signature)
			if (typeof headers[propKey] === 'function') {
				return function (...args: any[]) {
					switch (propKey) {
						case 'delete':
							modifications.headers.push(['delete', args[0]]);
							break;
						case 'set':
							modifications.headers.push(['set', args[0], args[1]]);
							break;
						case 'append':
							modifications.headers.push(['append', args[0], args[1]]);
							break;
					}

					// @ts-ignore (Headers don't have index signature)
					return headers[propKey].apply(headers, args);
				};
			}

			return Reflect.get(headers, propKey);
		},
	});
};
