// SPDX-License-Identifier: GPL-3.0-only
require('esbuild').buildSync({
  entryPoints: ['src/mini/app.jsx'], bundle: true, minify: true, legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'src/mini/app.bundle.js',
});

