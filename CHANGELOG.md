# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.0.2](https://github.com/statianzo/webpack-livereload-plugin/compare/v3.0.1...v3.0.2) (2021-08-04)

### [3.0.1](https://github.com/statianzo/webpack-livereload-plugin/compare/v3.0.0...v3.0.1) (2021-03-09)


### Bug Fixes

* **autoload:** Colon after protocol ([#65](https://github.com/statianzo/webpack-livereload-plugin/issues/65)) ([a876ff4](https://github.com/statianzo/webpack-livereload-plugin/commit/a876ff48ebf93ba6dca95603c0446043206f48d0))

### [3.0.0](https://github.com/webpack-contrib/mini-css-extract-plugin/compare/v2.3.0...v3.0.0) (2021-02-20)

### ⚠ POTENTIAL BREAKING CHANGE

Configuration is now be validated against schema and webpack v3 support was removed.
Node version have to be >= 10.18.0.

### Features

* Refactored logic from prototype class to class
* Switched from `done` hook to `afterEmit` because webpack v5 shrinks assets to SizeOnlySource
* Added config validation
* Restructured options from single attributes to options attribute
* Adding webpack as peerDependency and node > 10 as engine
* Removed webpack 3 support
