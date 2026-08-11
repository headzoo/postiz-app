const JsdomEnvironment =
  require('jest-environment-jsdom').default ||
  require('jest-environment-jsdom');
const Module = require('module');

const originalRequire = Module.prototype.require;

Module.prototype.require = function (request, ...rest) {
  if (request === 'canvas') {
    class MockImage {}

    return {
      createCanvas: () => ({
        getContext: () => null,
      }),
      Image: MockImage,
    };
  }

  return originalRequire.call(this, request, ...rest);
};

module.exports = JsdomEnvironment;
