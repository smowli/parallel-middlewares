# 🔀 Parallel Middlewares POC

When we have multiple asynchronous middlewares, executing them in parallel instead of serially (and awaiting each) can drastically reduce response times. Unfortunately, I did not find a Node.js-based web framework that allows for the parallel execution of middlewares — thus, this code was born. 👶 It is framework-agnostic as it uses standard Fetch API interfaces.

> ⚠️ Disclaimer: While this code is used in production, I still consider it just a proof of concept created to test the feasibility of this approach. It was tuned on middlewares that mainly modify request headers, and more complex use cases were out of scope. I am publishing this primarily for inspiration, and your production use may require major modifications.

# How it works under the hood - summary

Let's say we have two middlewares that we want to execute in parallel. These middlewares are passed to the connect function, which then receives the request object and handles the magic.

When called, both middlewares are invoked immediately with the same isolated copy of the request object as an argument, and the code waits until one of them resolves. Based on the result, the other middleware is either aborted, or the code waits for it to resolve. The modifications made to the request object by each middleware are internally tracked by a proxy object and then combined sequentially into a single output request object. The order in which these changes are applied depends on the mode defined in the arguments.

# Example / Demo

First you need to install node modules with `npm install`.

Then you can check out the usage by reviewing [the example test file](test/integration/example.spec.ts) and running `npm run test:example` or test the demo by running `npm run demo` and visiting `http://localhost:3000/`.

---

# In-depth design walkthrough

Middlewares are two-directional functions:

**First direction** is from the incoming request to responder function - MWs are called in ordered fashion from the first in array to the last one.

**Second direction** is from the responder function to outgoing response. If a MW returns a function this function will be invoked as the response is making its way back from the responder. The callback functions are called in opposite order to registered MWs in LIFO (last-in-first-out) fashion.

**The flow of executing middlewares can be simplified as going through layers of an onion peel down (middleware) to the core (responder function) and then back (callbacks)**

```
middleware1(request) -> middleware2(request) -> responder function(request): response -> middleware2 callback(response) -> middleware1 callback(response)
```

### MW Arguments

Middleware receives three arguments:

1. request object - either initial request object (if it is the first MW) or request that may be modified by previous MW
2. context object - shared context between all MWs provided by [connect function](#executing-middlewares-with-connect-function)
3. options object - options for the middleware provided by [connect function](#executing-middlewares-with-connect-function). It contains:
   - abortSignal - in some cases MW may be aborted by connect function. If this happens abort event is fired. You can use this to do cleanup or other things. The abortSignal is compatible with fetch API and can be passed directly to `fetch` and similar methods.

```ts
(
	req: Request,
	context: Context,
	options: { abortSignal?: AbortSignal }
)
```

### MW Return types

Middleware can return multiple types of value:

- `Nothing` (void/undefined) - if you need to add or modify some headers of the incoming request or do some task without modifying the request (e.g. request logger), you don't have to return anything and just call appropriate methods. Modified request will be passed to the next middleware. Example:

  ```
  (req) => {
      if(req.url.includes('my-query')) req.headers.set("some-header", "value")
  }
  ```

  - 🚧 Mainly modification of `request.headers` is supported.

- `Request` object: if a MW returns Request, it means that the returned request object will replace the initial request going forward to next MWs.

- `Function`: if a MW returns a function, the returned function is treated as a callback that is invoked once the response makes its way back. The response is passed to callback as an argument. Callbacks can alter or return a different response object that will be received by next callbacks.

- `Response` object: if a MW returns Response, it tells the program to not to continue in processing the next MW and immediately start building the response object. Which means that the request won't ever reach the responder function ... if there were MWs that registered a callback before this MW, their callbacks will be called as usual which means you can safely execute cleanup tasks and similar actions.

- Tuple of `[Request, Function]`: if you need to return the request object but still want to register a callback use this. There is no difference in the functionality.

## Executing middlewares with `connect` function

To connect the middlewares there is special function called `connect`. It is designed to be simple without abstracting the fetch API but also allow powerful features with a bit of creativity 🎨. Depending on your needs, you can choose if you execute MWs in `chain` or in `parallel`. The function isolates MW execution and guarantees that there is no difference in internal behavior of MWs between different execution types.

It takes request object, responder function and the list of MWs as arguments. Additionally you can pass context object which will be provided to every MW.

Parallel MWs are executed in isolation. Each receives a copy of the initial request object. This means that changes made by one MW are not visible to the other MWs. However modifications they perform are later combined together. The [execution mode](#choosing-execution-mode) determines how these results will be combined and what happens in special cases when some MWs return Response.

Executing MWs in parallel has some limitations:

- ⛔ MW cannot return new instance of the Request object as it could lead to unexpected results (Modifications of other MWs would be combined & applied to something different than initial request object). If MW returns new Request object an **error will be thrown**.

### Choosing execution mode

When executing MWs in parallel you can choose from two execution modes: `resolved-order` & `defined-order`.

#### `resolved-order`

- When to use:
  - order of modifications to the request object DOES NOT matter
  - you want to return the response as soon as one of the MWs returns the Response object
- Behavior:
  1. kick off all MWs and start waiting for their results
  2. order the results in the same order as they resolve
  3. if one MW returns a response
     1. abort remaining MWs
     2. call callbacks of already resolved MWs before this MW
  4. if none MW returns a response
     1. apply modifications of each MW in the same order as MWs resolved
     2. pass modified request to responder or next MW group
  5. continue with regular flow: responder -> callbacks

#### `defined-order`

- When to use:
  - order of modifications to the request object DOES matter
  - you want to return the response from the MW which was registered earlier
- Behavior:
  1. kick off all MWs and start waiting for their results
  2. order the results in the same order as they were passed to connect function
  3. if one MW returns a response
     1. wait for all MWs which were passed before this MW to resolve
     2. abort remaining MWs
     3. call callbacks of MWs which were registered before this MW
  4. if none MW returns a response
     1. apply modifications of each MW in the same order as MWs were passed to connect function
     2. pass modified request to responder or next MW group
  5. continue with regular flow: responder -> callbacks
