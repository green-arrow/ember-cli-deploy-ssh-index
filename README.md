# ember-cli-deploy-ssh-index

> An ember-cli-deploy plugin to upload revisions to a remote server via SSH

[![Build Status](https://travis-ci.org/green-arrow/ember-cli-deploy-ssh-index.svg?branch=master)](https://travis-ci.org/green-arrow/ember-cli-deploy-ssh-index) [![](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-ssh-index.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)

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

### Required configuration options

#### filePattern (`required`)

A file matching this pattern will be uploaded to your remote host. The active revision on the host will match `filePattern`. The versioned keys will have `revisionKey` appended (Ex: `index.html:39a2f02`).

*Default:* `'index.html'`

#### host (`required`)

The remote host to which the revision will be deployed.

*Default:* `undefined`

#### port (`required`)

The port of the remote host.

*Default:* `22`

#### privateKeyFile (`required`)

The path to the private key to use when connecting to the remote host.
Ex: `'~/.ssh/id_rsa'`

*Default:* `undefined`

#### remoteDir (`required`)

The directory on the remote host to which the revision will be deployed.

*Default:* `undefined`

#### username (`required`)

The username to use when connecting to the remote host.

*Default:* `undefined`

### Optional configuration options

#### allowOverwrite

A flag to specify whether the revision should be overwritten if it already exists on the remote host.

*Default:* `false`

#### distDir

The root directory where the file matching `filePattern` will be searched for. By default, this option will use the `distDir` property of the deployment context.

*Default:* `context.distDir`

#### passphrase

The passphrase used to protect your `privateKeyFile`.

For security, this should be passed in via an environment variable.

```javascript
{
  'ssh-index': {
    // Other configuration...
    passphrase: process.env.PRIVATE_KEY_PASSPHRASE
  }
}
```

*Default:* `undefined`

#### revisionKey

The unique revision number for the version of the file being uploaded to the remote host. By default this option will use either the `revisionKey` passed in from the command line or the `revisionKey` property from the deployment context.

*Default:* `context.commandLineArgs.revisionKey || context.revisionKey`

### How do I activate a revision?

A user can activate a revision by either:

- Passing a command line argument to the `deploy` command:

```bash
$ ember deploy staging --activate
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

So, if the `filePattern` was configured to be `index.html` and there had been a few revisons deployed, then `remoteDir` on your remote host might look something like this:

```bash
$ ls -l <remoteDir>
-rw-rw-r-- 1 ec2-user ec2-user     1 Dec 10 22:45 a644ba4.active-revision
-rw-rw-r-- 1 ec2-user ec2-user 22616 Dec 10 22:45 index.html
-rw-rw-r-- 1 ec2-user ec2-user 22616 Dec 10 22:45 index.html:a644ba4
-rw-rw-r-- 1 ec2-user ec2-user 22616 Dec  8 05:38 index.html:61cfff6
-rw-rw-r-- 1 ec2-user ec2-user 22616 Dec  1 10:22 index.html:9dd26db
```

Activating a revision would copy the content of the passed revision to `index.html` which would be served up by a web server (such as Nginx) on your remote host. Activating one of the revisions above would look like this:

```bash
$ ember deploy:activate --revision a644ba4
```

Additionally, activation creates an empty file where the filename is the revision key, with an extension of `.active-revision`. This is what is used to determine the currently active revision on the remote host. On activation, all previous `.active-revision` files are removed and a new one is created, based on the revision being activated.

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
