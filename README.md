# gettit.js

Where jammit falls in love with javascript.

## Jamming Off Rails

[jammit](http://documentcloud.github.com/jammit/) provides the ability to package, concatenate and compress javascript and CSS resources and allows you to pre cache assets by using the eponymous utility. However, to take advantage of the packaging and templating facilities the application has to be running in a Rails environment. This is where gettit comes in.

With gettit, you can take advantage of all the jammit goodness - assets manifest, packaging based on environment, debug mode, javascript templating (jst), etc. - without Rails. In place of the jammit Rails templating, gettit uses a simple javascript api to load packages on demand.

### Docs

[documentation](http://delambo.github.com/gettit/)

[annotated source](http://delambo.github.com/gettit/docs/annotated/)

### Download

[version 0.6.0](http://delambo.github.com/gettit/downloads/gettit_0.6.0.zip)

### Code

[github](https://github.com/delambo/gettit)

### Example

[Backbone.js todo app that is loaded with gettit.](https://github.com/delambo/gettit/tree/master/example)

## Usage

### Quick Demo

The following is an example manifest file (assets.yml) you would use for dependency management and building in jammit:

```yml
  package_assets: on 
  compress_assets: on
  template_function: _.template
  javascript_compressor: closure

  javascripts:
    scripts:
      - js/model/content.js
      - js/template/content.jst
    common:
      - js/common/string.js
      - js/common/template/menu.jst

  stylesheets:
    styles:
      - css/common/style.css
```

To load packages in production and development, gettit gives you the ability to create and re-use loaders to load packages from your jammit configuration:

```html
  <script type="text/javascript" src="gettit.js"></script>
  <script type="text/javascript">
    var loader = gettit.getLoader({
      assetsConfiguration: 'assets.yml',
      environment: 'development',
      assetsPath: '',
      buildPath: 'build/'
    });

    loader.get(['scripts', 'common'], 'styles', function() {
      // Take care of business after the packages have loaded.
    });
  </script>
```

## gettit API

### getLoader

Uses the following options to return a package loader:

 - `assetsConfiguration`: Path to the jammit assets config file, relative to the `assetsPath` or a full url.
 - `assetsPath`: Pre-pended to asset paths when fetching.
 - `environment`: gettit supports "development" or "production" modes for package loading. In development, gettit will load scripts, templates, and stylesheets defined in the jammit manifest from the given `assetsPath`. In production, jammit will use the `buildPath` to load the jammit compressed packages.
 - `build ath`: Prepended to production asset packages when fetching in the production envrionment.
 - `version`: Optional parameter appended to urls to bust browser cache in production. Usually this property would be dynamically configured for each production build.
 - `callback`: Optional callback that will be called after all of the packages are loaded.
 - `isDebugging`: Defaults to false, but if true, this loader will be configured to always load in debug/development environment.

```javascript
  var loader = gettit.getLoader(options)
```

## loader API

### get

Loads asset packages with three parameters: list of javascripts packages, list of stylesheets packages, and an optional callback. If only one javascript or stylesheet package is needed, then a single package name (string) will suffice.

```javascript
  loader.get(['scripts', 'common'], 'styles', function() {
    // Take care of business after the packages have loaded.
  });
```

## Debugging

As defined by jammit, gettit will respect the `debug_assets=true` url param-value when loading in production, and load the individual assets instead of the packages.


## Compatibility

### Cross-Domain Requests

If assets are fetched cross-domain _when using debug mode_ in production, or in development, then CORS support is required on the server that houses the assets.

### Browser Support

Browser support is the same as [lab.js support](http://labjs.com/documentation.php), unless files in production and/or development are being fetched cross-domain, which requires CORS support, and [mostly affects IE, requiring version 8+](http://caniuse.com/cors).

### Limitations

Unfortunately, you can't use glob rules in the jammit configuration/assets file because gettit wouldn't know how to expand the patterns for fetching files and paths.

## License

MIT

## Change Log

#### 0.6.0

- The _WHOLE_ API changed - gettit is a required script and the api was changed to construct package loaders.

#### 0.5.0

 - Initial release (extracted and cleaned up from various javascript apps).
