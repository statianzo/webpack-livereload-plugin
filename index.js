/* jshint node:true */
var tinylr = require('tiny-lr');

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.port = this.options.port || 35729;
  this.server = tinylr(this.options);
  this.lastHash = null;
}

LiveReloadPlugin.prototype.start = function start() {
  var port = this.port;
  this.server.listen(this.port, function() {
    process.stdout.write('Live Reload listening on port ' + port + '\n');
  });
};

LiveReloadPlugin.prototype.done = function done(stats) {
  var files = Object.keys(stats.compilation.assets);
  var hash = stats.compilation.hash;

  if (hash !== this.lastHash) {
    this.lastHash = hash;
    this.server.notifyClients(files);
  }
};

LiveReloadPlugin.prototype.failed = function failed() {
  this.lastHash = null;
};

LiveReloadPlugin.prototype.apply = function apply(compiler) {
  this.compiler = compiler;
  if (this.compiler.options.watch) {
    this.start();
  }

  compiler.plugin('done', this.done.bind(this));
  compiler.plugin('failed', this.failed.bind(this));
};

module.exports = LiveReloadPlugin;
