/* jshint node:true */
var tinylr = require('tiny-lr');

function LiveReloadPlugin(options) {
  this.options = options || {};
  this.port = this.options.port || 35729;
  this.server = tinylr(this.options);
}

LiveReloadPlugin.prototype.start = function start() {
  var port = this.port;
  this.server.listen(this.port, function() {
    process.stdout.write('Live Reload listening on port ' + port + '\n');
  });
};

LiveReloadPlugin.prototype.done = function done(stats) {
  var files = Object.keys(stats.compilation.assets);
  this.server.notifyClients(files);
};

LiveReloadPlugin.prototype.apply = function apply(compiler) {
  this.compiler = compiler;
  if (this.compiler.options.watch) {
    this.start();
  }

  compiler.plugin('done', this.done.bind(this));
};

module.exports = LiveReloadPlugin;
