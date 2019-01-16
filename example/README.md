# es-modules-middleware example

This example project uses the `es-modules-middleware` in both an `express` based server and a `karma` test.

## Installation

```bash
npm install
```

## Running

To spin up the webserver run:

```bash
npm run server
```

Then navigate to http://localhost:3000/index.html, you should see a smiley face! This demonstration is built using `lit-element` as a node_module dependency and is an example of a custom web component built using ES-modules.

To run the tests run:

```bash
npm run test
```

Chrome should launch and the test should execute and be reported as success on the commandline. NOTE: you may need to set your `CHROME_BIN` environment variable to point to your chrome executable.

If you are on Windows, try using the [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10) to run these tests.
