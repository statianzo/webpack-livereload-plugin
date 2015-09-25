# webpack-livereload-plugin

LiveReload when running `webpack --watch`

## Installation

Install the package

```
npm install --save-dev webpack-livereload-plugin
```

Add the plugin to your webpack config

```js
// webpack.config.js

var LiveReloadPlugin = require('webpack-livereload-plugin');

module.exports = {
  plugins: [
    new LiveReloadPlugin(options)
  ]
}
```

Add a script tag to your page pointed at the livereload server

```html
<script src="http://localhost:35729/livereload.js"></script>
```


## Options

- `port` - (Default: 35729) The desired port for the livereload server
- `appendScriptTag` - (Default: false) Append livereload `<script>`
                   automatically to `<head>`.

## Why?

Yes, there's already `webpack-dev-server` that handles live reloading
and more complex scenarios. This project aims to solve the case where
you want assets served by your app server, but still want reloads
triggered from webpack's build pipeline.
