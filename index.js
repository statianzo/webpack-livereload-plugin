/* jshint node:true */
var lr = require('tiny-lr');
var servers = {};
var crypto = require('crypto')
var fs = require('fs');

function checksum (str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex')
}

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.ssl = !!this.options.key;
  this.port = this.options.port || 35729;
  this.ignore = this.options.ignore || null;
  this.lastHash = {};
  this.hostname = this.hostname || 'localhost';
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
  var include = files.filter(function(file) {
    return !file.match(this.ignore);
  }, this);
  var hashes = {};
  var modifiedFiles = [];

  include.forEach(function(fileName){
    var src = stats.compilation.assets[fileName].existsAt;
    var hash = checksum(fs.readFileSync(src));
    hashes[fileName] = hash;
    if( hash !== this.lastHash[fileName] ) modifiedFiles.push(fileName);
  }.bind(this));

  if(this.isRunning) {
    this.lastHash = hashes;
    this.server.notifyClients(modifiedFiles);
  }
};

LiveReloadPlugin.prototype.failed = function failed() {
  this.lastHash = {};
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
    '  el.src = "' + (this.ssl ? 'https' : 'http') + '://' + this.hostname + ':' + this.port + '/livereload.js";',
    '  document.head.appendChild(el);',
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
