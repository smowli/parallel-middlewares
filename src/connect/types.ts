// ! This interface is meant to be extended by consumer
export interface MiddlewareContext {}

export type OptionalPromise<T> = Promise<T> | T;

export type ParallelExecutionType = 'defined-order' | 'resolved-order';

export type MiddlewareCallback<Context extends MiddlewareContext = MiddlewareContext> = (
	res: Response,
	context: Context
) => OptionalPromise<Response | void>;

export type MiddlewareResponse<Context extends MiddlewareContext = MiddlewareContext> =
	OptionalPromise<
		void | Request | Response | MiddlewareCallback<Context> | [Request, MiddlewareCallback<Context>]
	>;

export type Middleware<Context extends MiddlewareContext = MiddlewareContext> = (
	req: Request,
	context: Context,
	options: { abortSignal?: AbortSignal }
) => MiddlewareResponse<Context>;

export type Responder<Context extends MiddlewareContext = MiddlewareContext> = (
	request: Request,
	context: Context
) => OptionalPromise<Response>;
