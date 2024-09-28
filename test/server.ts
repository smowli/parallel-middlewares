import Express, { RequestHandler } from 'express';
import { Middleware } from '../src/connect';
import { connectMws, adaptMwToExpress } from './express/middleware';
import { delay as mockRemoteCall } from './utils';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const responseTimeMw: RequestHandler = (req, res, next) => {
	const currentTime = Date.now();

	res.locals.getElapsedTime = () => Date.now() - currentTime;

	next();
};

const authMw: Middleware = async req => {
	console.log('Auth Middleware');

	const { token } = await mockRemoteCall(3000, { token: '20f7c7a7262f' });

	req.headers.set('authorization', token);
};

const redirectMw: Middleware = async req => {
	console.log('Redirect Middleware');

	const { redirectTo } = await mockRemoteCall(2000, { redirectTo: undefined });

	if (redirectTo) return Response.redirect(redirectTo, 302);
};

const sendResponse: RequestHandler = (req, res) => {
	res.send(
		`Server sent the response after ${res.locals.getElapsedTime() / 1000}s. Headers: { authorization: ${req.headers.authorization} }`
	);
};

const app = Express();
const port = 3000;

app.get('/', function (_, res) {
	res.sendFile(join(__dirname, './express/index.html'));
});

app.get(
	'/serial', //
	responseTimeMw,
	...adaptMwToExpress([authMw, redirectMw]),
	sendResponse
);

app.get(
	'/parallel', //
	responseTimeMw,
	connectMws('defined-order', [authMw, redirectMw]),
	sendResponse
);

app.listen(port, () => {
	console.log(`Express server running. Visit http://localhost:${port}`);
});
