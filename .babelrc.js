const plugins = [
  [
    require.resolve('babel-plugin-module-resolver'),
    {
      root: ["./dist/"],
      alias: {
        "@core": "./dist/core",
        "@utils": "./dist/utils",
        "@integrations": "./dist/integrations"
      }
    }
  ]
];

module.exports = {
  plugins,
  ignore: [
    'src/**/*.js'
  ]
}
