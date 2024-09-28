export const defaultUrl = (path = '/') =>
	`https://localhost${`/${path}`.replace(new RegExp('/[/]+', 'g'), '/')}`;

export const defaultRequest = (path = defaultUrl()) => new Request(path);

export const delay = <T = unknown>(
	time: number,
	data?: T
): Promise<T extends (...args: any) => any ? ReturnType<T> : T> =>
	new Promise(res => {
		setTimeout(() => {
			res(typeof data === 'function' ? data() : data);
		}, time);
	});
