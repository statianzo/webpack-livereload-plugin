/* jshint node:true */
const crypto = require('crypto');
const lr = require('tiny-lr');
const portfinder = require('portfinder');
const anymatch = require('anymatch');
const servers = {};
const schema = require('./schema.json');
let {validate} = require('schema-utils');

const PLUGIN_NAME = 'LiveReloadPlugin';

class LiveReloadPlugin {
  constructor(options = {}) {
    // Fallback to schema-utils v1 for webpack v4
    if (!validate)
      validate = require('schema-utils');

    validate(schema, options, {name: 'Livereload Plugin'});

    this.defaultPort = 35729;
    this.options = Object.assign({
      protocol: '',
      port: this.defaultPort,
      hostname: '" + location.hostname + "',
      ignore: null,
      quiet: false,
      useSourceHash: false,
      useSourceSize: false,
      appendScriptTag: false,
      delay: 0,
    }, options);

    // Random alphanumeric string appended to id to allow multiple instances of live reload
    this.instanceId = crypto.randomBytes(8).toString('hex');
    this.lastHash = null;
    this.lastChildHashes = [];
    this.server = null;
    this.sourceHashs = {};
    this.sourceSizes = {};
    this.webpack = null;
    this.infrastructureLogger = null;
    this.isWebpack4 = false;
  }

  apply(compiler) {
    this.webpack = compiler.webpack ? compiler.webpack : require('webpack');
    this.infrastructureLogger = compiler.getInfrastructureLogger ? compiler.getInfrastructureLogger(PLUGIN_NAME) : null;
    this.isWebpack4 = compiler.webpack ? false : typeof compiler.resolvers !== 'undefined';

    compiler.hooks.compilation.tap(PLUGIN_NAME, this._applyCompilation.bind(this));
    compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, this._start.bind(this));
    compiler.hooks.afterEmit.tap(PLUGIN_NAME, this._afterEmit.bind(this));
    compiler.hooks.emit.tap(PLUGIN_NAME, this._emit.bind(this));
    compiler.hooks.failed.tap(PLUGIN_NAME, this._failed.bind(this));
  }

  /**
   * @param a1
   * @param a2
   * @returns {boolean|*}
   */
  static arraysEqual(a1, a2) {
    return a1.length === a2.length && a1.every((v,i) => v === a2[i])
  }

  /**
   * @param str
   * @returns {string}
   */
  static generateHashCode(str) {
    const hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
  }

  /**
   *
   * @param compilation
   * @returns {*}
   * @private
   */
  _applyCompilation(compilation) {
    if (this.isWebpack4) {
      return compilation.mainTemplate.hooks.startup.tap(PLUGIN_NAME, this._scriptTag.bind(this));
    }

    this.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(compilation).renderRequire.tap(PLUGIN_NAME, this._scriptTag.bind(this));
  }

  /**
   * @param watching
   * @param cb
   * @private
   */
  _start(watching, cb) {
    if (servers[this.options.port]) {
      this.server = servers[this.options.port];
      return cb();
    }

    const listen = (err = null, port = null) => {
      if (err) return cb(err);

      this.options.port = port || this.options.port;

      this.server = servers[this.options.port] = lr({
        ...this.options,
        errorListener: (err) => {
          this.logger.error(`Live Reload disabled: ${err.message}`);
          if (err.code !== 'EADDRINUSE') {
            this.logger.error(err.stack);
          }
          cb();
        },
      });

      this.server.listen(this.options.port, (err) => {
        if (!err && !this.options.quiet) {
          this.logger.info(`Live Reload listening on port ${this.options.port}`);
        }
        cb();
      });
    };

    if(this.options.port === 0) {
      portfinder.basePort = this.defaultPort;
      portfinder.getPort(listen);
    } else {
      listen();
    }
  }

  /**
   * @returns {boolean}
   * @private
   */
  _isRunning() {
    return !!this.server;
  }

  /**
   * @private
   * @param compilation
   */
  _afterEmit(compilation) {
    const hash = compilation.hash;
    const childHashes = (compilation.children || []).map(child => child.hash);

    const include = Object.entries(compilation.assets)
        .filter(this._fileIgnoredOrNotEmitted.bind(this))
        .filter(this._fileSizeDoesntMatch.bind(this))
        .filter(this._fileHashDoesntMatch.bind(this))
        .map((data) => data[0])
    ;

    if (
        this._isRunning()
        && include.length > 0
        && (hash !== this.lastHash || !LiveReloadPlugin.arraysEqual(childHashes, this.lastChildHashes))
    ) {
      this.lastHash = hash;
      this.lastChildHashes = childHashes;
      setTimeout(() => {
        this.server.notifyClients(include);
      }, this.options.delay);
    }
  }

  /**
   * @private
   * @param compilation
   */
  _emit(compilation) {
    Object.entries(compilation.assets).forEach(this._calculateSourceHash.bind(this));
  }

  /**
   * @private
   */
  _failed() {
    this.lastHash = null;
    this.lastChildHashes = [];
    this.sourceHashs = {};
    this.sourceSizes = {};
  }

  /**
   * @returns {string}
   * @private
   */
  _autoloadJs() {
    const protocol = this.options.protocol;
    const fullProtocol = `${protocol}${protocol ? ':' : ''}`
    return (
        `
        // webpack-livereload-plugin
        (function() {
          if (typeof window === "undefined") { return };
          var id = "webpack-livereload-plugin-script-${this.instanceId}";
          if (document.getElementById(id)) { return; }
          var el = document.createElement("script");
          el.id = id;
          el.async = true;
          el.src = "${fullProtocol}//${this.options.hostname}:${this.options.port}/livereload.js";
          document.getElementsByTagName("head")[0].appendChild(el);
          console.log("[Live Reload] enabled");
        }());
        `
    );
  }

  /**
   * @param source
   * @returns {*}
   * @private
   */
  _scriptTag(source) {
    if (this.options.appendScriptTag && this._isRunning()) {
      return this._autoloadJs() + source;
    }
    else {
      return source;
    }
  }

  /**
   * @param data
   * @returns {boolean|*}
   * @private
   */
  _fileIgnoredOrNotEmitted(data) {
    const size = this.isWebpack4 ? data[1].emitted : data[1].size();

    if (Array.isArray(this.options.ignore)) {
      return !anymatch(this.options.ignore, data[0]) && size;
    }

    return !data[0].match(this.options.ignore) && size;
  }

  /**
   * Check compiled source size
   *
   * @param data
   * @returns {boolean}
   * @private
   */
  _fileSizeDoesntMatch(data) {
    if (!this.options.useSourceSize)
      return true;

    if (this.sourceSizes[data[0]] === data[1].size()) {
      return false;
    }

    this.sourceSizes[data[0]] = data[1].size();
    return true;
  }

  /**
   * Check compiled source hash
   *
   * @param data
   * @returns {boolean}
   * @private
   */
  _fileHashDoesntMatch(data) {
    if (!this.options.useSourceHash)
      return true;

    if (
        this.sourceHashs[data[0]] !== undefined
        && this.sourceHashs[data[0]].hash === this.sourceHashs[data[0]].calculated
    ) {
      return false;
    }

    // Update source hash
    this.sourceHashs[data[0]].hash = this.sourceHashs[data[0]].calculated;
    return true;
  }

  /**
   * Calculate compiled source hash
   *
   * @param data
   * @returns {void}
   * @private
   */
  _calculateSourceHash(data) {
    if (!this.options.useSourceHash) return;

    // Calculate source hash
    this.sourceHashs[data[0]] = {
      hash: this.sourceHashs[data[0]] ? this.sourceHashs[data[0]].hash : null,
      calculated: LiveReloadPlugin.generateHashCode(data[1].source())
    };
  }

  /**
   * @private
   */
  get logger() {
    if (this.infrastructureLogger) {
      return this.infrastructureLogger;
    }

    // Fallback logger webpack v3
    return {
      error: console.error,
      warn: console.log,
      info: console.log,
      log: console.log,
      debug: console.log,
      trace: console.log,
      group: console.log,
      groupEnd: console.log,
      groupCollapsed: console.log,
      status: console.log,
      clear: console.log,
      profile: console.log,
    }
  }
}

module.exports = LiveReloadPlugin;
