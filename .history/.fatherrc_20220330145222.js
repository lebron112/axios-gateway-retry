export default {
  entry: 'src/index.ts',
  cjs: {
    type: 'babel',
    minify: false,
    file: './cjs'
  },
  // esm: {
  //   type: 'rollup',
  //   esm: true,
  //   minify: false,
  //   file:'./lib/esm'
  // },
  esm: {
    type: 'rollup',
    mjs: true,
    minify: false,
  },
  target: 'browser',
}