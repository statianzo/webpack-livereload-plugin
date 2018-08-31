/* jshint node:true */
const crypto = require('crypto');
var lr = require('tiny-lr');
var portfinder = require('portfinder');
var servers = {};

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.defaultPort = 35729;
  this.port = typeof this.options.port === 'number' ? this.options.port : this.defaultPort;
  this.ignore = this.options.ignore || null;
  this.quiet = this.options.quiet || false;
  // Random alphanumeric string appended to id to allow multiple instances of live reload
  this.instanceId = crypto.randomBytes(8).toString('hex');

  // add delay, but remove it from options, so it doesn't get passed to tinylr
  this.delay = this.options.delay || 0;
  delete this.options.delay;

  this.lastHash = null;
  this.lastChildHashes = [];
  this.protocol = this.options.protocol ? this.options.protocol + ':' : '';
  this.hostname = this.options.hostname || '" + location.hostname + "';
  this.server = null;
}

function arraysEqual(a1, a2){
  return a1.length==a2.length && a1.every(function(v,i){return v === a2[i]})
}

Object.defineProperty(LiveReloadPlugin.prototype, 'isRunning', {
  get: function() { return !!this.server; }
});

LiveReloadPlugin.prototype.start = function start(watching, cb) {
  var quiet = this.quiet;
  if (servers[this.port]) {
    this.server = servers[this.port];
    cb();
  }
  else {
    const listen = function() {
      this.server = servers[this.port] = lr(this.options);

      this.server.errorListener = function serverError(err) {
        console.error('Live Reload disabled: ' + err.message);
        if (err.code !== 'EADDRINUSE') {
          console.error(err.stack);
        }
        cb();
      };

      this.server.listen(this.port, function serverStarted(err) {
        if (!err && !quiet) {
          console.log('Live Reload listening on port ' + this.port + '\n');
        }
        cb();
      }.bind(this));
    }.bind(this);

    if(this.port === 0) {
      portfinder.basePort = this.defaultPort;
      portfinder.getPort(function portSearchDone(err, port) {
        if (err) {
          throw err;
        }
    
        this.port = port;

        listen()
      }.bind(this));
    } else {
      listen();
    }
  }
};

LiveReloadPlugin.prototype.done = function done(stats) {
  var hash = stats.compilation.hash;
  var childHashes = (stats.compilation.children || []).map(child => child.hash);
  var files = Object.keys(stats.compilation.assets);
  var include = files.filter(function(file) {
    return !file.match(this.ignore);
  }, this);

  if (this.isRunning && (hash !== this.lastHash || !arraysEqual(childHashes, this.lastChildHashes)) && include.length > 0) {
    this.lastHash = hash;
    this.lastChildHashes = childHashes;
    setTimeout(function onTimeout() {
      this.server.notifyClients(include);
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
    '  var id = "webpack-livereload-plugin-script-' + this.instanceId + '";',
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
