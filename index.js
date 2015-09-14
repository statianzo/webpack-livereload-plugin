/* jshint node:true */
var tinylr = require('tiny-lr');
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
    this.server = servers[port] = tinylr(this.options);
    this.server.listen(this.port, function(err) {
      if (!err) {
        process.stdout.write('Live Reload listening on port ' + port + '\n');
      }
      cb(err);
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

LiveReloadPlugin.prototype.apply = function apply(compiler) {
  this.compiler = compiler;

  compiler.plugin('watch-run', this.start.bind(this));
  compiler.plugin('done', this.done.bind(this));
  compiler.plugin('failed', this.failed.bind(this));
};

module.exports = LiveReloadPlugin;
