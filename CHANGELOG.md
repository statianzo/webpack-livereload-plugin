# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
