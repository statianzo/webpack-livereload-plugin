var test = require('tape');
var LiveReloadPlugin = require('./index');

test('default options', function(t) {
  var plugin = new LiveReloadPlugin();
  t.equal(plugin.port, 35729);
  t.equal(plugin.ignore, null);
  t.equal(plugin.isRunning, false);
  t.equal(plugin.quiet, false);
  t.end();
});

test('not running', function(t) {
  var plugin = new LiveReloadPlugin();
  t.equal(plugin.isRunning, false);
  t.end();
});

test('running after start', function(t) {
  var plugin = new LiveReloadPlugin();
  plugin.start(null, function() {
    t.notLooseEqual(plugin.server, null);
    t.ok(plugin.isRunning);
    plugin.server.on('close', function() {
      t.end();
    });
    plugin.server.close();
  });
});

test('finds available ports', function(t) {
  var plugin1 = new LiveReloadPlugin({port: 0});
  var plugin2 = new LiveReloadPlugin({port: 0});

  var count = 0;
  var tryEnd = function() {
    count++;
    if(count === 2) {
      t.notEqual(plugin1.port, plugin2.port);
      t.end();
    }
  }

  var startPlugin = function(p) {
    p.start(null, function() {
      t.notLooseEqual(p.server, null);
      t.ok(p.server !== undefined)
      t.ok(p.isRunning);
      p.server.on('close', function() {
        tryEnd();
      });
      setTimeout(function() {
        p.server.close();
      });
    });
  }

  startPlugin(plugin1);
  startPlugin(plugin2);
});

test('notifies when done', function(t) {
  var plugin = new LiveReloadPlugin();
  var stats = {
    compilation: {
      assets: {'b.js': '123', 'a.js': '456', 'c.css': '789'},
      hash: 'hash',
      children: []
    }
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['a.js', 'b.js', 'c.css']);
      t.equal(plugin.lastHash, stats.compilation.hash);
      t.end();
    }
  };
  plugin.done(stats);
});

test('filters out ignored files', function(t) {
  var plugin = new LiveReloadPlugin({
    ignore: /\.css$/
  });
  var stats = {
    compilation: {
      assets: {'b.js': '123', 'a.js': '456', 'c.css': '789'},
      children: []
    }
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['a.js', 'b.js']);
      t.end();
    }
  };
  plugin.done(stats);
});

test('children trigger notification', function(t) {
  var plugin = new LiveReloadPlugin();
  var stats = {
    compilation: {
      assets: {'b.js': '123', 'a.js': '456', 'c.css': '789'},
      hash: null,
      children: [{hash:'hash'}]
    }
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(plugin.lastChildHashes, stats.compilation.children.map(function(child) {
        return child.hash;
      }));
      t.end();
    }
  };
  plugin.done(stats);
});

test('autoloadJs hostname defaults to location.hostname', function(t) {
  var plugin = new LiveReloadPlugin();
  t.assert(plugin.autoloadJs().match(/ \+ location\.hostname \+ /));
  t.end();
});

test('autoloadJs contains hostname option', function(t) {
  var plugin = new LiveReloadPlugin({hostname: 'example.com'});
  t.assert(plugin.autoloadJs().match(/example.com/));
  t.end();
});

test('every instance has random id', function(t) {
  var plugin = new LiveReloadPlugin();
  var plugin2 = new LiveReloadPlugin();
  t.notEqual(plugin.instanceId, plugin2.instanceId);
  t.end();
});

test('autoloadJs contains instanceId', function(t) {
  var plugin = new LiveReloadPlugin();
  t.assert(plugin.autoloadJs().match(plugin.instanceId));
  t.end();
});
