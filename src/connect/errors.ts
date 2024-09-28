export abstract class ConnectError extends Error {}

export class MiddlewareInvalidReturnError extends ConnectError {
	static message(value?: any) {
		return `❌ Middleware returned invalid result value: ${value}.`;
	}

	constructor(value?: any) {
		super();
		this.message = MiddlewareInvalidReturnError.message(value);
	}
}

export class ParallelMiddlewareReplaceRequestError extends ConnectError {
	static message() {
		return `❌ Parallel middlewares cannot replace Request object as it could lead to unexpected result when applying modifications of other middlewares`;
	}

	constructor() {
		super();
		this.message = ParallelMiddlewareReplaceRequestError.message();
	}
}
