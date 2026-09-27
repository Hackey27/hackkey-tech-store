# shared/

Both the Express server and the browser bundle import from this directory, so
nothing browser-specific (React, DOM APIs, `import.meta.env`, anything from
`src/components/`) and nothing server-specific (Firestore, `node:` builtins,
secrets) belongs in it.

The point is that both sides run the *same* code: `money.ts` is the single place
money arithmetic happens, and the payment check compares the order amount
against Paystack's integer for exact equality — which only holds while server
and browser share one `cedisToPesewas`, not two copies of it.
