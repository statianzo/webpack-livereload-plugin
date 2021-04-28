const test = require('tape');
const crypto = require('crypto');
const LiveReloadPlugin = require('./index');

test('default options', function(t) {
  const plugin = new LiveReloadPlugin();
  t.equal(plugin.options.protocol, '');
  t.equal(plugin.options.port, 35729);
  t.equal(plugin.options.hostname, '" + location.hostname + "');
  t.equal(plugin.options.ignore, null);
  t.equal(plugin.options.quiet, false);
  t.equal(plugin.options.useSourceHash, false);
  t.equal(plugin.options.useSourceSize, false);
  t.equal(plugin.options.appendScriptTag, false);
  t.equal(plugin.options.delay, 0);
  t.equal(plugin._isRunning(), false);
  t.end();
});

test('not running', function(t) {
  const plugin = new LiveReloadPlugin();
  t.equal(plugin._isRunning(), false);
  t.end();
});

test('running after start', function(t) {
  const plugin = new LiveReloadPlugin();
  plugin._start(null, function() {
    t.notLooseEqual(plugin.server, null);
    t.ok(plugin._isRunning());
    plugin.server.on('close', function() {
      t.end();
    });
    plugin.server.close();
  });
});

test('finds available ports', function(t) {
  const plugin1 = new LiveReloadPlugin({port: 0});
  const plugin2 = new LiveReloadPlugin({port: 0});

  let count = 0;
  const tryEnd = function() {
    count++;
    if(count === 2) {
      t.notEqual(plugin1.options.port, plugin2.options.port);
      t.end();
    }
  };

  const startPlugin = function(p) {
    p._start(null, function() {
      t.notLooseEqual(p.server, null);
      t.ok(p.server !== undefined)
      t.ok(p._isRunning());
      p.server.on('close', function() {
        tryEnd();
      });
      setTimeout(function() {
        p.server.close();
      });
    });
  };

  startPlugin(plugin1);
  startPlugin(plugin2);
});

test('notifies when done', function(t) {
  const plugin = new LiveReloadPlugin();
  const compilation = {
    assets: {
      'b.js': {
        emitted: true, size: () => 1
      },
      'a.js': {
        emitted: true,
        size: () => 1
      },
      'c.css': {
        emitted: true,
        size: () => 1
      },
      'd.css': {
        emitted: false,
        size: () => 0
      }
    },
    hash: 'hash',
    children: []
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['a.js', 'b.js', 'c.css']);
      t.equal(plugin.lastHash, compilation.hash);
      t.end();
    }
  };
  plugin._afterEmit(compilation);
});

test('filters out ignored files', function(t) {
  const plugin = new LiveReloadPlugin({
    ignore: /\.css$/
  });
  const compilation = {
    assets: {
      'b.js': {
        emitted: true,
        size: () => 1
      },
      'a.js': {
        emitted: true,
        size: () => 1
      },
      'c.css': {
        emitted: true,
        size: () => 1
      },
      'd.css': {
        emitted: false,
        size: () => 0
      }
    },
    children: []
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['a.js', 'b.js']);
      t.end();
    }
  };
  plugin._afterEmit(compilation);
});

test('filters out ignored files as array', function(t) {
  const plugin = new LiveReloadPlugin({
    ignore: [/.map/, /.json/]
  });
  const compilation = {
    assets: {
      'b.js': {
        emitted: true,
        size: () => 1
      },
      'a.js': {
        emitted: true,
        size: () => 1
      },
      'c.map': {
        emitted: true,
        size: () => 1
      },
      'd.json': {
        emitted: true,
        size: () => 1
      }
    },
    children: []
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['a.js', 'b.js']);
      t.end();
    }
  };
  plugin._afterEmit(compilation);
});

test('filters out hashed files', function(t) {
  function hashCode(str) {
    const hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
  }

  const plugin = new LiveReloadPlugin({
    useSourceHash: true,
  });
  const compilation = {
    assets: {
      'c.js': {
        emitted: true,
        size: () => 1,
        source: () => "asdf",
      },
      'b.js': {
        emitted: true,
        size: () => 1,
        source: () => "asdf",
      },
      'a.js': {
        emitted: true,
        size: () => 1,
        source: () => "asdf",
      },
    },
    children: []
  };
  plugin.sourceHashs = {
    'b.js': {hash: 'Wrong hash'},
    'a.js': {hash: hashCode('asdf')},
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['b.js', 'c.js']);
      t.end();
    }
  };
  plugin._emit(compilation);
  plugin._afterEmit(compilation);
});

test('filters out resized files', function(t) {
  const plugin = new LiveReloadPlugin({
    useSourceSize: true,
  });
  const compilation = {
    assets: {
      'c.js': {
        emitted: true,
        size: () => 10,
      },
      'b.js': {
        emitted: true,
        size: () => 10,
      },
      'a.js': {
        emitted: true,
        size: () => 20,
      },
    },
    children: []
  };
  plugin.sourceSizes = {
    'b.js': 20,
    'a.js': 20,
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(files.sort(), ['b.js', 'c.js']);
      t.end();
    }
  };
  plugin._afterEmit(compilation);
});

test('children trigger notification', function(t) {
  const plugin = new LiveReloadPlugin();
  const compilation = {
    assets: {
      'b.js': {
        emitted: true,
        size: () => 1
      },
      'a.js': {
        emitted: true,
        size: () => 1
      },
      'c.css': {
        emitted: false,
        size: () => 0
      }
    },
    hash: null,
    children: [{hash:'hash'}]
  };
  plugin.server = {
    notifyClients: function(files) {
      t.deepEqual(plugin.lastChildHashes, compilation.children.map(function(child) {
        return child.hash;
      }));
      t.end();
    }
  };
  plugin._afterEmit(compilation);
});

test('autoloadJs hostname defaults to location.hostname', function(t) {
  const plugin = new LiveReloadPlugin();
  t.assert(plugin._autoloadJs().match(/ \+ location\.hostname \+ /));
  t.end();
});

test('autoloadJs contains hostname option', function(t) {
  const plugin = new LiveReloadPlugin({hostname: 'example.com'});
  t.assert(plugin._autoloadJs().match(/example.com/));
  t.end();
});

test('every instance has random id', function(t) {
  const plugin = new LiveReloadPlugin();
  const plugin2 = new LiveReloadPlugin();
  t.notEqual(plugin.instanceId, plugin2.instanceId);
  t.end();
});

test('autoloadJs contains instanceId', function(t) {
  const plugin = new LiveReloadPlugin();
  t.assert(plugin._autoloadJs().match(plugin.instanceId));
  t.end();
});

test('autoloadJs suffixes protocol with colon', function(t) {
  const plugin = new LiveReloadPlugin({
    protocol: 'https'
  });
  const [,src] = plugin._autoloadJs().match(/src\s+=\s+"(.+)"/)
  t.assert(src.startsWith('https://'));
  t.end();
});


test('autoloadJs suffixes empty protocol without colon', function(t) {
  const plugin = new LiveReloadPlugin();
  const [,src] = plugin._autoloadJs().match(/src\s+=\s+"(.+)"/)
  t.assert(src.startsWith('//'));
  t.end();
});
