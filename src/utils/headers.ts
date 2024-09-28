import { SetCookieHeader } from './cookies';

export enum HEADERS {
	SetCookie = 'set-cookie',
	Authorization = 'authorization',
	ContentType = 'content-type',
	Location = 'location',
	Cookie = 'cookie',
}

/**
 * Copies specified headers by names to new Headers object.
 */
export const extractHeaders = (headerNames: string[], sourceHeaders: Headers): Headers => {
	const resultHeaders = new Headers();

	headerNames.forEach(headerName => {
		const value = sourceHeaders.get(headerName);

		if (!value) return; // does not exist, nothing to copy

		if (headerName === HEADERS.SetCookie) {
			// set-cookie header is a special case
			SetCookieHeader.fromHeaders(sourceHeaders).applyTo(resultHeaders);
			return;
		}

		resultHeaders.set(headerName, value);
	});

	return resultHeaders;
};

/**
 * Combines passed headers to new Headers object. If there are headers with the same name,
 * their values are not combined and instead the later value will be used. To delete a header
 * you can pass object like `{ headerName: null }` which marks it for deletion.
 */
export const mergeHeaders = (
	headersArray: [Headers, ...(Headers | Record<string, string | null>)[]]
): Headers => {
	const [base, ...rest] = headersArray;

	const finalHeaders = new Headers(base);

	rest.forEach(headers => {
		const isHeaderClass = headers instanceof Headers;

		// use Set - we care only about unique names and set-cookie header can be returned multiple times
		const headerNames = new Set(isHeaderClass ? [...headers.keys()] : Object.keys(headers));

		headerNames.forEach(headerName => {
			const value = isHeaderClass ? (headers.get(headerName) as string) : headers[headerName];

			if (value === null) {
				finalHeaders.delete(headerName);
				return;
			}

			if (headerName === HEADERS.SetCookie) {
				if (isHeaderClass) {
					SetCookieHeader.fromHeaders(headers).applyTo(finalHeaders);
					return;
				}

				// If object is passed it can only contain single "set-cookie" property
				finalHeaders.append(headerName, value);
				return;
			}

			finalHeaders.set(headerName, value);
		});
	});

	return finalHeaders;
};
