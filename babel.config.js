// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin is required by reanimated 4.x for
      // gesture-driven transforms to run on the UI thread. The older
      // 'react-native-reanimated/plugin' name is deprecated on SDK 57.
      // Must be listed LAST so it transforms the other plugins' output too.
      'react-native-worklets/plugin',
    ],
  };
};
