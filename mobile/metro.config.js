const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

// Desktop pure modules (../src) are imported as @shared/*.
config.watchFolders = [...(config.watchFolders ?? []), root];
// mobile/node_modules first for bare imports made from ../src (e.g. @dagrejs/dagre in mapLayout.ts).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
// Files under ../src would otherwise resolve upward into the root node_modules (desktop deps).
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  const shared = context.originModulePath.startsWith(path.join(root, 'src') + path.sep);
  if (shared && !name.startsWith('.') && !name.startsWith('@shared')) {
    return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, 'index.js') }, name, platform);
  }
  return (upstream ?? context.resolveRequest)(context, name, platform);
};

module.exports = config;
