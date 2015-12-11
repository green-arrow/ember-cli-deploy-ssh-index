**NOTE** This addon is currently under development and IS NOT fully functional yet. Once it is fully functional, a release will be published to NPM. Use at your own risk.

# ember-cli-deploy-ssh-index

> An ember-cli-deploy plugin to upload revisions to a remote server via SSH

[![](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-ssh-index.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)

This plugin uploads a file, presumably index.html, to a specified folder on a remote server via SSH.

This plugin is heavily based on [ember-cli-deploy-s3-index](https://github.com/ember-cli-deploy/ember-cli-deploy-s3-index) and [ember-cli-deploy-ssh](https://github.com/eddflrs/ember-cli-deploy-ssh)

## What is an ember-cli-deploy plugin?

A plugin is an addon that can be executed as a part of the ember-cli-deploy pipeline. A plugin will implement one or more of the ember-cli-deploy's pipeline hooks.

For more information on what plugins are and how they work, please refer to the [Plugin Documentation][1].

## Quick Start

To get up and running quickly, do the following:

- Ensure [ember-cli-deploy-build][3] is installed and configured.
- Ensure [ember-cli-deploy-revision-data][4] is installed and configured.
- Ensure [ember-cli-deploy-display-revisions][5] is installed and configured.

- Install this plugin

```bash
$ ember install ember-cli-deploy-ssh-index
```

- Place the following configuration into `config/deploy.js`

```javascript
ENV['ssh-index'] = {
  username: '<your-remote-username>',
  host: '<your-remote-host>',
  remoteDir: '<your-remote-directory>',
  privateKeyFile: '<absolute-path-to-private-key>'
}
```

- Run the pipeline

```bash
$ ember deploy
```

## Installation
Run the following command in your terminal:

```bash
ember install ember-cli-deploy-ssh-index
```

## ember-cli-deploy Hooks Implemented

For detailed information on what plugin hooks are and how they work, please refer to the [Plugin Documentation][1].

- `upload`
- `activate`
- `fetchRevisions`

## Configuration Options

For detailed information on how configuration of plugins works, please refer to the [Plugin Documentation][1].

### allowOverwrite

A flag to specify whether the revision should be overwritten if it already exists on the remote host.

### username (`required`)

The username to use when connecting to the remote host.

*Default:* `undefined`

### host (`required`)

The remote host to which the revision will be deployed.

*Default:* `undefined`

### port (`required`)

The port of the remote host.

*Default:* `22`

### remoteDir (`required`)

The directory on the remote host to which the revision will be deployed.

*Default:* `undefined`

### privateKeyFile (`required`)

The path to the private key to use when connecting to the remote host. This **must** be an absolute path (not relative like `~/.ssh/id_rsa`).

*Default:* `undefined`

### filePattern (`required`)

A file matching this pattern will be uploaded to your remote host. The active revision on the host will match `filePattern`. The versioned keys will have `revisionKey` appended (Ex: `index::39a2f02.html`).

*Default:* `'index.html'`

### distDir

The root directory where the file matching `filePattern` will be searched for. By default, this option will use the `distDir` property of the deployment context.

*Default:* `context.distDir`

### revisionKey

The unique revision number for the version of the file being uploaded to S3. By default this option will use either the `revisionKey` passed in from the command line or the `revisionKey` property from the deployment context.

*Default:* `context.commandLineArgs.revisionKey || context.revisionKey`

### How do I activate a revision?

A user can activate a revision by either:

- Passing a command line argument to the `deploy` command:

```bash
$ ember deploy --activate=true
```

- Running the `deploy:activate` command:

```bash
$ ember deploy:activate --revision <revision-key>
```

- Setting the `activateOnDeploy` flag in `deploy.js`

```javascript
ENV.pipeline {
  activateOnDeploy: true
}
```

### What does activation do?

When *ember-cli-deploy-ssh-index* uploads a file to a remote host, it uploads it under the key defined by a combination of the two config properties `filePattern` and `revisionKey`.

So, if the `filePattern` was configured to be `index.html` and there had been a few revisons deployed, then `remoteDir` on your remote hostmight look something like this:

```bash
$ ls <remoteDir>
2015-09-27 07:47:42       1207 index.html
2015-09-27 07:25:51       1207 index.html:a644ba43cdb987288d646c5a97b1c8a9
2015-09-27 07:20:27       1207 index.html:61cfff627b79058277e604686197bbbd
2015-09-27 07:19:11       1207 index.html:9dd26dbc8f3f9a8a342d067335315a63
```

Activating a revision would copy the content of the passed revision to `index.html` which would be served up by a web server (such as Nginx) on your remote host.

```bash
$ ember deploy:activate --revision a644ba43cdb987288d646c5a97b1c8a9
```

### When does activation occur?

Activation occurs during the `activate` hook of the pipeline. By default, activation is turned off and must be explicitly enabled by one of the 3 methods above.

## Prerequisites

The following properties are expected to be present on the deployment `context` object:

- `distDir`                     (provided by [ember-cli-deploy-build][3])
- `project.name()`              (provided by [ember-cli-deploy][2])
- `revisionKey`                 (provided by [ember-cli-deploy-revision-key][4])
- `commandLineArgs.revisionKey` (provided by [ember-cli-deploy][2])
- `deployEnvironment`           (provided by [ember-cli-deploy][2])

[1]: http://ember-cli.github.io/ember-cli-deploy/plugins "Plugin Documentation"
[2]: https://github.com/ember-cli/ember-cli-deploy "ember-cli-deploy"
[3]: https://github.com/ember-cli-deploy/ember-cli-deploy-build "ember-cli-deploy-build"
[4]: https://github.com/ember-cli-deploy/ember-cli-deploy-revision-data "ember-cli-deploy-revision-data"
[5]: https://github.com/ember-cli-deploy/ember-cli-deploy-display-revisions "ember-cli-deploy-display-revisions"
