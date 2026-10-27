// iOS 27 traps at launch unless the app adopts the UIScene life cycle. Expo 57 ships
// ExpoAppSceneDelegate but prebuild's AppDelegate template doesn't use it yet.
// ponytail: string patches on the generated AppDelegate; drop this plugin once prebuild emits scene support.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

module.exports = config => {
  config = withInfoPlist(config, c => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        }],
      },
    };
    return c;
  });
  return withAppDelegate(config, c => {
    let src = c.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return c;
    src = src
      .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      // The scene delegate creates the window and starts React Native.
      .replace(/#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow[\s\S]*?#endif\n/, '');
    if (src.includes('window = UIWindow(frame')) throw new Error('withSceneLifecycle: AppDelegate template changed; update the plugin.');
    c.modResults.contents = `${src}\nclass SceneDelegate: ExpoAppSceneDelegate {}\n`;
    return c;
  });
};
