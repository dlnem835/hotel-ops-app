/** Shim so Node scripts can import modules that declare `import "server-only"`. */
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};
