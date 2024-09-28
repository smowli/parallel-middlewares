/**
 * Create a copy of the Request and set provided properties to it without
 * modifying the original object.
 */
export const copyRequest = (request: Request, init?: RequestInit) => {
	return new Request(request, init);
};
