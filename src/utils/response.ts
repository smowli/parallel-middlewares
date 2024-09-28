import { HEADERS } from './headers';

/**
 * Create a copy of the Response and set provided properties to it without
 * modifying the original object.
 */
export const copyResponse = (response: Response, init?: ResponseInit) => {
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
		...init,
	});
};

export const jsonResponse = Response.json;

export const textResponse = (data: string, init?: ResponseInit): Response => {
	return new Response(data, {
		...init,
		headers: {
			[HEADERS.ContentType]: 'text/plain',
			...init?.headers,
		},
	});
};

export const redirectResponse = Response.redirect;
