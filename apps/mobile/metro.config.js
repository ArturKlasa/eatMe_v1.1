// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo so Metro picks up workspace package changes
// and can resolve modules through pnpm's virtual store (node_modules/.pnpm/).
// NOTE: on Linux without Watchman, Metro's FallbackWatcher crashes with ENOENT
// if a package (e.g. esbuild) creates and immediately deletes _tmp_* directories
// during binary self-extraction while Metro is scanning. Install Watchman to
// avoid this:  sudo apt install watchman
config.watchFolders = [monorepoRoot];

// Resolve modules from the monorepo root node_modules as well as the app's own
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Polyfill Node built-ins that some packages (e.g. react-native-svg) import.
// React Native's runtime doesn't include Node's standard library, so Metro
// must redirect these to browser-compatible npm packages.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(projectRoot, 'node_modules/buffer'),
};

module.exports = config;
