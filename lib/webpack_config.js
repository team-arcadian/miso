const glob = require('glob');

const { Paths } = require('./utils');
const { merge } = require('webpack-merge');
const { relative, resolve } = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 * Generates entry object by scanning directories
 * for *.pack.scss, *.pack.sass, and *.pack.js files
 *
 * @param {array} dirs
 * @return {Object} entry object
 */
function _entry(dirs = []) {
  // TODO this needs to ignore vendor files...
  return dirs.reduce((memo, dir) => {
    const packs = glob.sync(resolve(dir, '**/*[^_].+(css|js)'));
    packs.forEach((pack) => {
      const key = relative(dir, pack);
      /* eslint-disable-next-line no-param-reassign */
      memo[key] = [pack];
    });

    return memo;
  }, {});
}

/**
 * Scans entries for Sass files, and excludes the associated .js garbage files
 *
 * @param {Object} entry
 * @return {array} list of files to remove from the final output
 */
function _removeFiles(entry) {
  return Object.entries(entry).reduce((memo, [key, value]) => {
    if (value[0].match(/\.pack\.s[ac]ss/)) {
      memo.push(`${key}.js`);
      memo.push(`${key}.js.map`);
    }
    return memo;
  }, []);
}

/**
 * Removes files after Webpack compilation
 * Primarily used to remove superfluous JS files created during Sass compilation
 */
function RemoveFilesPlugin(options = {}) {
  this.files = new Set(options.files || []);
}

RemoveFilesPlugin.prototype.apply = function apply(compiler) {
  compiler.hooks.emit.tap(this.constructor.name, (compilation) => {
    for (const file of Object.keys(compilation.assets)) {
      if (!this.files.has(file)) { continue; }
      /* eslint-disable-next-line no-param-reassign */
      delete compilation.assets[file];
    }
  });
};

/**
 * Dynamic config for Webpack
 *
 * @param {string} options
 * @return {Object} Webpack configuration
 */
const config = (mode = 'production', assets = [], modules = [], outputDir = false) => {
  // Ensure array inputs are actually arrays.
  const moduleDirs = Array.isArray(modules) ? modules : [modules];
  const assetDirs = Array.isArray(assets) ? assets : [assets];

  const context = resolve(Paths.packageRoot(), 'node_modules');
  const entry = _entry(assetDirs);
  const output = outputDir ? { filename: '[name].js', path: outputDir } : {};
  const removeFiles = _removeFiles(entry);
  const resolveModules = [context, ...moduleDirs];
  const devtool = mode === 'development' ? 'source-map' : false;

  // TODO hand in custom webpack config which is help in vapid instance `options`
  const defaultConfig = {
    mode,
    context,
    entry,
    output,
    devtool,

    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            { loader: MiniCssExtractPlugin.loader },
            { loader: 'css-loader', options: { url: false, sourceMap: true } },
            { loader: 'postcss-loader' },
            { loader: 'resolve-url-loader' },
          ],
        },
      ],
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new RemoveFilesPlugin({
        files: removeFiles,
      }),
    ],

    resolve: {
      modules: resolveModules,
    },
  };

  return merge(defaultConfig, {});
}

module.exports = config;
