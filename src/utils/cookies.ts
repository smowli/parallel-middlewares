import { HEADERS } from './headers';
import { parseString, splitCookiesString } from 'set-cookie-parser';
import { serialize } from 'cookie';

export interface Cookie {
	name: string;
	value: string;
	expires?: Date;
	maxAge?: number;
	domain?: string;
	path?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
}

export const parseSetCookieHeader = (headers: Headers): Cookie[] => {
	return splitCookiesString(headers.get(HEADERS.SetCookie) || '').map(
		str => parseString(str) as Cookie
	);
};

export const setCookie = (headers: Headers, { name, value, ...options }: Cookie) => {
	headers.append(HEADERS.SetCookie, serialize(name, value, options));
	return headers;
};

export const clearCookie = (cookie: Cookie): Cookie => {
	return {
		...cookie,
		expires: new Date(0),
		value: '',
	};
};

/**
 * Class to make working with set-cookie headers easier.
 *
 * According to RFC every header can be set only once - unfortunately there is an
 * exception for "set-cookie" header and working with set-cookie header sucks!
 * Special handler for this header has to be used. Read more here
 * -> (search for "set-cookie") https://www.rfc-editor.org/rfc/rfc7230#appendix-A.2.3
 */

export class SetCookieHeader {
	// use map to make working with cookies easier
	private cookies: Map<string, Cookie>;
	private initialHeadersObject: Headers | undefined;

	constructor(cookies: Record<string, Omit<Cookie, 'name'>> = {}, headers?: Headers) {
		this.initialHeadersObject = headers;
		// convert passed object to cookies map and use object key as cookie name
		this.cookies = new Map(
			Object.entries(cookies).map(([name, value]) => [name, { name, ...value }])
		);
	}

	/**
	 * Removes cookie from the list of set-cookie headers.
	 */
	delete(names: string | string[]): SetCookieHeader {
		if (Array.isArray(names)) {
			names.forEach(name => this.cookies.delete(name));
			return this;
		}

		this.cookies.delete(names);
		return this;
	}

	/**
	 * Sets cookie in the list of set-cookie headers. Existing cookie with same name is overwritten.
	 */
	set(name: string, cookie: Omit<Cookie, 'name'>): SetCookieHeader;
	set(cookies: Array<Cookie>): SetCookieHeader;
	set(firstArg: string | Array<Cookie>, secondArg?: Omit<Cookie, 'name'>): SetCookieHeader {
		const cookieArr = Array.isArray(firstArg) ? firstArg : [{ name: firstArg, ...secondArg! }];

		cookieArr.forEach(cookie => {
			this.cookies.set(cookie.name, cookie);
		});

		return this;
	}

	/**
	 * Clear cookie value.
	 */
	clear(names: string | string[]) {
		const nameArray = Array.isArray(names) ? names : [names];

		nameArray.forEach(name => {
			const cookie = this.cookies.get(name) || { name, value: '' };
			this.cookies.set(name, clearCookie(cookie));
		});

		return this;
	}

	/**
	 * Get cookie by name.
	 */
	get(name: string) {
		return this.cookies.get(name);
	}

	/**
	 * Apply the current list of cookies as set-cookies headers to provided headers object.
	 */
	applyTo(headers: Headers, clearInitial = false): Headers {
		if (clearInitial) headers.delete(HEADERS.SetCookie);

		const existingCookies = parseSetCookieHeader(headers);

		// setCookie function does check if the cookie is already there - we need to deduplicate the cookies
		const allCookies = {
			...Object.fromEntries(existingCookies.map(cookie => [cookie.name, cookie])),
			...Object.fromEntries(this.cookies.entries()),
		};

		// Clear the header because we will assign all existing cookies in the next step
		headers.delete(HEADERS.SetCookie);

		Object.values(allCookies).forEach(cookie => setCookie(headers, cookie));

		return headers;
	}

	/**
	 * Apply the current list of cookies as set-cookies headers to headers object that
	 * was provided during initialization (constructor, fromHeaders(), ...). If this class
	 * was initialized without headers object, nothing will happen.
	 */
	apply(): void {
		if (this.initialHeadersObject) this.applyTo(this.initialHeadersObject, true);
	}

	/** Initialize the class from list of present set-cookies headers in the provided headers object. */
	static fromHeaders(headers: Headers) {
		return new SetCookieHeader(
			// map set-cookies headers to object of cookies - the key is a cookie name
			Object.fromEntries(
				parseSetCookieHeader(headers).map(({ name, ...cookie }) => [name, cookie])
			),
			headers
		);
	}

	get cookieMap() {
		return Object.fromEntries(this.cookies.entries());
	}

	get value() {
		const headers = new Headers(this.initialHeadersObject);

		this.applyTo(headers);

		return headers;
	}
}
