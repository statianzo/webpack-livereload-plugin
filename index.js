/* jshint node:true */
var statSync = require('fs').statSync;
var lr = require('tiny-lr');
var servers = {};

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.port = this.options.port || 35729;
  this.ignore = this.options.ignore || null;
  this.quiet = this.options.quiet || false;

  // add delay, but remove it from options, so it doesn't get passed to tinylr
  this.delay = this.options.delay || 0;
  delete this.options.delay;

  this.lastHash = null;
  this.lastChildHashes = [];
  this.protocol = this.options.protocol ? this.options.protocol + ':' : '';
  this.hostname = this.options.hostname || '" + location.hostname + "';
  this.server = null;

  this.startTime = new Date();
  this.startTime.setSeconds(-process.uptime());
  this.prevTimestamps = {};
}

function arraysEqual(a1, a2){
  return a1.length==a2.length && a1.every(function(v,i){return v === a2[i]})
}

Object.defineProperty(LiveReloadPlugin.prototype, 'isRunning', {
  get: function() { return !!this.server; }
});

LiveReloadPlugin.prototype.start = function start(watching, cb) {
  var port = this.port;
  var quiet = this.quiet;
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
      if (!err && !quiet) {
        console.log('Live Reload listening on port ' + port + '\n');
      }
      cb();
    });
  }
};

LiveReloadPlugin.prototype.done = function done(stats) {
  var timestamps = stats.compilation ? stats.compilation.fileTimestamps : {};
  var assets = stats.compilation.assets;
  var include = [];

  // If no timestamp information is available, use all assets.
  if (!timestamps) {
    include.push.apply(include, Object.keys(assets));
  }
  else {
    this.changedFiles = Object.keys(timestamps).filter(function(watchfile) {
      return this.startTime < Math.ceil(statSync(watchfile).mtime);
    }.bind(this)).forEach(function(changedFile) {
      Object.keys(assets).forEach(function(assetName) {
        const asset = Object.assign({}, assets[assetName]);
        const sources = [];

        if (asset.emitted && asset.existsAt.split('.').slice(-1)[0] !== 'css') {
          include.push(assetName);
        }

        (asset.children || []).forEach(function(child) {
          if (child && child._sourceMap && child._sourceMap.sources) {
            sources.push.apply(sources, child._sourceMap.sources);
          }
        });

        if (sources.includes(changedFile)) {
          include.push(assetName);
        }
      }, this);
    }, this);
  }

  this.startTime = Date.now();

  var hash = stats.compilation.hash;
  var childHashes = (stats.compilation.children || []).map(child => child.hash);
  var updated = include.filter(function(file) {
    return !file.match(this.ignore);
  }, this);

  if (this.isRunning && (hash !== this.lastHash || !arraysEqual(childHashes, this.lastChildHashes)) && updated.length > 0) {
    this.lastHash = hash;
    this.lastChildHashes = childHashes;
    setTimeout(function onTimeout() {
      this.server.notifyClients(updated);
    }.bind(this), this.delay);
  }
};

LiveReloadPlugin.prototype.failed = function failed() {
  this.lastHash = null;
  this.lastChildHashes = [];
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
    '  el.src = "' + this.protocol + '//' + this.hostname + ':' + this.port + '/livereload.js";',
    '  document.getElementsByTagName("head")[0].appendChild(el);',
    '}());',
    ''
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
  compilation.mainTemplate.hooks.startup.tap('LiveReloadPlugin', this.scriptTag.bind(this));
};

LiveReloadPlugin.prototype.apply = function apply(compiler) {
  this.compiler = compiler;
  compiler.hooks.compilation.tap('LiveReloadPlugin', this.applyCompilation.bind(this));
  compiler.hooks.watchRun.tapAsync('LiveReloadPlugin', this.start.bind(this));
  compiler.hooks.done.tap('LiveReloadPlugin', this.done.bind(this));
  compiler.hooks.failed.tap('LiveReloadPlugin', this.failed.bind(this));
};

module.exports = LiveReloadPlugin;
