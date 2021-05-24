# CFN to CDK

Experimental. Translates Cloudformation JSON to AWS CDK TypeScript. Understands parameters, cross-resource references, AWS functions & pseudo-parameters.

Usage (assuming node.js 10 or newer):

```bash
git clone https://github.com/mipearson/cfntocdk.git
cd cfntocdk
npm i && npm build && npm link
npx cfntocdk MyStack mystack.json > mystack.ts
```

Run the integration tests to see working examples:

```bash
npm i --dev
npm run jest
ls tmp/*.ts
```

Type errors are expected in the output at this stage: you'll need to clean them up by hand.

Valid CloudFormation can generated invalid CDK: CDK is much stricter about numbers being numbers, and outputs can't have the same name as resources.

## TODO:

- Parameters are referenced as `parameter.value`, which is almost always a type error even though it generates the "correct" stack. Remember what type of parameter we have and attempt to cast it appropriately.

- Conditions almost always lead to type errors. Add a "--as-any-conditions" option to allow generation of code that'll produce less typing errors for prototyping.

- Only integration tests exist today, making testing edge cases very difficult. Add unit tests.
