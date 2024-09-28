import { describe, expect, it } from 'vitest';
import { parseSetCookieHeader, setCookie, SetCookieHeader } from './cookies';

describe('Cookie utilities', () => {
	it('Should return an empty array if no set-cookie header is present', () => {
		const headers = new Headers();

		expect(parseSetCookieHeader(headers)).toEqual([]);
	});

	it('Should set cookies and parse set-cookie header', () => {
		const headers = new Headers();

		setCookie(headers, {
			name: 'sessid',
			value: 'session',
			httpOnly: true,
			secure: true,
		});

		setCookie(headers, {
			name: 'name',
			value: 'value',
			domain: 'domain.com',
			expires: new Date('2023-09-15'),
			httpOnly: true,
			maxAge: 1000,
			path: '/',
			sameSite: 'strict',
			secure: true,
		});

		expect(parseSetCookieHeader(headers)).toMatchInlineSnapshot(`
			[
			  {
			    "httpOnly": true,
			    "name": "sessid",
			    "secure": true,
			    "value": "session",
			  },
			  {
			    "domain": "domain.com",
			    "expires": 2023-09-15T00:00:00.000Z,
			    "httpOnly": true,
			    "maxAge": 1000,
			    "name": "name",
			    "path": "/",
			    "sameSite": "Strict",
			    "secure": true,
			    "value": "value",
			  },
			]
		`);
	});
});

describe(SetCookieHeader.name, () => {
	it('Should manage set-cookie header', () => {
		const headers = new Headers();

		headers.append('set-cookie', 'cookie1=v1');
		headers.append('set-cookie', 'cookie1=v2');

		const setCookies = SetCookieHeader.fromHeaders(headers);

		setCookies.set('cookie1', {
			value: 'v2',
			httpOnly: true,
			sameSite: 'strict',
			secure: true,
		});

		setCookies.set([
			{ name: 'cookie2', value: 'b' },
			{ name: 'cookie3', value: 'c' },
		]);

		setCookies.delete('cookie3');

		setCookies.set('cookie4', { value: 'd' });

		setCookies.set('clear1', {
			value: 'clear',
			httpOnly: true,
			path: '/',
			sameSite: 'strict',
			secure: true,
		});

		setCookies.clear(['clear1', 'clear2']);

		setCookies.apply();

		expect(headers.get('set-cookie')).toBe(
			'cookie1=v2; HttpOnly; Secure; SameSite=Strict, cookie2=b, cookie4=d, clear1=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict, clear2=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
		);

		expect(setCookies.cookieMap).toMatchObject({
			cookie1: {
				name: 'cookie1',
				value: 'v2',
			},
			cookie2: {
				name: 'cookie2',
				value: 'b',
			},
			cookie4: {
				name: 'cookie4',
				value: 'd',
			},
			clear1: {
				name: 'clear1',
				value: '',
			},
			clear2: {
				name: 'clear2',
				value: '',
			},
		});
	});

	it('Should support method chaining', () => {
		const headers = new Headers();
		new SetCookieHeader({})
			.set('cookie1', { value: 'a' })
			.set('cookie2', { value: 'b' })
			.set([
				{ name: 'cookie3', value: 'c' },
				{ name: 'cookie4', value: 'd' },
				{ name: 'cookie5', value: 'e' },
			])
			.delete('cookie1')
			.delete(['cookie3', 'cookie5'])
			.applyTo(headers);

		expect(headers.get('set-cookie')).toBe('cookie2=b, cookie4=d');
	});

	it('Should modify initial set-cookie header if headers are passed to the constructor', () => {
		const headers = new Headers();

		headers.append('set-cookie', 'cookie1=a');
		headers.append('set-cookie', 'cookie2=b');

		new SetCookieHeader({}, headers)
			.set('cookie3', { value: 'c' })
			.set('cookie4', { value: 'd' })
			.apply();

		expect(headers.get('set-cookie')).toBe('cookie3=c, cookie4=d');
	});
});
