import { Request as ExpressRequest, RequestHandler } from 'express';
import { connect, Middleware, ParallelExecutionType } from '../../src/connect';

const convertExpressToFetch = (req: ExpressRequest): Request => {
	const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

	const headers: { [key: string]: string } = {};

	for (let i = 0; i < req.rawHeaders.length; i += 2) {
		const [headerName, headerValue] = req.rawHeaders.slice(i, i + 1);
		headers[headerName] = headerValue;
	}

	return new Request(fullUrl, {
		headers,
		body: req.body,
		method: req.method,
	});
};

const copyFetchToExpress = (req: Request, expressReq: ExpressRequest) => {
	expressReq.body = req.body;
	expressReq.method = req.method;

	[...req.headers.entries()].forEach(([name, value]) => {
		expressReq.headers[name] = value;
	});
};

export const adaptMwToExpress = (mws: Middleware[]): RequestHandler[] => {
	return mws.map(mw => {
		return async (expressReq, expressRes, next) => {
			const request = convertExpressToFetch(expressReq);
			await mw(request, {}, {});
			copyFetchToExpress(request, expressReq);
			next();
		};
	});
};

export const connectMws = (
	type: ParallelExecutionType,
	middlewares: Array<Middleware>
): RequestHandler => {
	return async (expressReq, expressRes, next) => {
		await connect(
			convertExpressToFetch(expressReq),
			request => {
				copyFetchToExpress(request, expressReq);
				return new Response();
			},
			[[type, ...middlewares]]
		);
		next();
	};
};
