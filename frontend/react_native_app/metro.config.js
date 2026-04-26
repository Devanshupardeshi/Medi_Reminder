// Default Expo Metro config. Required for `@/*` tsconfig path aliases
// to resolve at runtime (Expo Router + tsconfigPaths experiment).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
