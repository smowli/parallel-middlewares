# 🔀 Parallel Middlewares POC

When you have multiple asynchronous middlewares, executing them in parallel instead of serially (and awaiting each) can drastically reduce response times. Unfortunately, I did not find a Node.js-based web framework that allows for the parallel execution of middlewares — thus, this code was born. 👶 It is framework-agnostic as it uses standard Fetch API interfaces.

> ⚠️ Disclaimer: While this code is used in production, I still consider it just a proof of concept created to test the feasibility of this approach. It was tuned on middlewares that mainly modify request headers, and more complex use cases were out of scope. I am publishing this primarily for inspiration, and your production use may require major modifications.

# How it works under the hood - summary

Let's say we have two middlewares that we want to execute in parallel. These middlewares are passed to the connect function, which then receives the request object and handles the magic.

When called, both middlewares are invoked immediately with the same isolated copy of the request object as an argument, and the code waits until one of them resolves. Based on the result, the other middleware is either aborted, or the code waits for it to resolve. The modifications made to the request object by each middleware are internally tracked by a proxy object and then combined sequentially into a single output request object. The order in which these changes are applied depends on the mode defined in the arguments.

# Example / Demo

First you need to install node modules with `npm install`.

Then you can check out the usage by reviewing [the example test file](test/integration/example.spec.ts) and running `npm run test:example` or test the demo by running `npm run demo` and visiting `http://localhost:3000/`.
