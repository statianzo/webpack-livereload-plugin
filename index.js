/* jshint node:true */
var lr = require('tiny-lr');
var servers = {};

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.port = this.options.port || 35729;
  this.lastHash = null;
  this.server = null;
}

Object.defineProperty(LiveReloadPlugin.prototype, 'isRunning', {
  get: function() { return !!this.server; }
});

LiveReloadPlugin.prototype.start = function start(watching, cb) {
  var port = this.port;
  if (servers[port]) {
    this.server = servers[port];
    cb();
  }
  else {
    this.server = servers[port] = lr(this.options);
    this.server.errorListener = function serverError(err) {
      console.error('Live Reload disabled: ' + err.message);
      if (err.code !== 'EADDRINUSE') {
        console.error(err.stack);
      }
      cb();
    };
    this.server.listen(this.port, function serverStarted(err) {
      if (!err) {
        console.log('Live Reload listening on port ' + port + '\n');
      }
      cb();
    });
  }
};

LiveReloadPlugin.prototype.done = function done(stats) {
  var files = Object.keys(stats.compilation.assets);
  var hash = stats.compilation.hash;

  if (this.isRunning && hash !== this.lastHash) {
    this.lastHash = hash;
    this.server.notifyClients(files);
  }
};

LiveReloadPlugin.prototype.failed = function failed() {
  this.lastHash = null;
};

LiveReloadPlugin.prototype.autoloadJs = function autoloadJs() {
  return [
    '// webpack-livereload-plugin',
    '(function() {',
    '  if (typeof window === "undefined") { return };',
    '  var id = "webpack-livereload-plugin-script";',
    '  if (document.getElementById(id)) { return; }',
    '  var el = document.createElement("script");',
    '  el.id = id;',
    '  el.async = true;',
    '  el.src = "http://localhost:' + this.port + '/livereload.js";',
    '  document.head.appendChild(el);',
    '}());\n'
  ].join('\n');
};

LiveReloadPlugin.prototype.scriptTag = function scriptTag(source) {
  var js = this.autoloadJs();
  if (this.options.appendScriptTag && this.isRunning) {
    return js + source;
  }
  else {
    return source;
  }
};

LiveReloadPlugin.prototype.applyCompilation = function applyCompilation(compilation) {
  compilation.mainTemplate.plugin('startup', this.scriptTag.bind(this));
};

LiveReloadPlugin.prototype.apply = function apply(compiler) {
  this.compiler = compiler;
  compiler.plugin('compilation', this.applyCompilation.bind(this));
  compiler.plugin('watch-run', this.start.bind(this));
  compiler.plugin('done', this.done.bind(this));
  compiler.plugin('failed', this.failed.bind(this));
};

module.exports = LiveReloadPlugin;
