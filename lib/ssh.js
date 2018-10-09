var CoreObject = require('core-object');
var RSVP       = require('rsvp');
var ssh2       = require('ssh2');
var fs         = require('fs');
var path       = require('path');
var untildify  = require('untildify');
var Promise    = RSVP.Promise;
var readFile   = RSVP.denodeify(fs.readFile);

var ACTIVE_REVISION_EXT = '.active-revision';

// GENERAL TODO: Figure out how to handle pipeline failure instead of
// just doing Promise.reject

module.exports = CoreObject.extend({
  init: function(options) {
    this._super(options);
    var plugin = options.plugin;

    this._plugin = plugin;
    this._client = new ssh2.Client();
  },

  upload: function(options) {
    var that           = this;
    var plugin         = this._plugin;
    var allowOverwrite = options.allowOverwrite;
    var revisionKey    = options.revisionKey;
    var filePath       = options.filePath;
    var filename       = path.join(options.remoteDir, options.filePattern + ':' + revisionKey);

    options.autoClose = false;

    return that.fetchRevisions(options).then(function(revisions) {
      return that._validateRevision(revisions, revisionKey, allowOverwrite);
    })
    .then(readFile.bind(that, filePath))
    .then(function(fileContents) {
      return that._writeFile(fileContents, filename);
    })
    .then(function() {
      plugin.log('✔  ' + filename, { verbose: true });
      that._client.end();

      return Promise.resolve();
    });
  },

  activate: function(options) {
    var that         = this;
    var plugin       = that._plugin;
    var remoteDir    = options.remoteDir;
    var revisionKey  = options.revisionKey;
    var revisionPath = path.join(options.remoteDir, options.filePattern + ":" + revisionKey);
    var indexPath    = path.join(options.remoteDir, options.filePattern);

    return that.fetchRevisions(options).then(function(revisions) {
      var revisionExists = that._revisionExists(revisions, revisionKey);

      if (revisionExists) {
        return Promise.all([
          that._copyFile(revisionPath, indexPath),
          that._markActiveRevision(remoteDir, revisionKey)
        ])
        .then(function() {
          plugin.log('✔  ' + revisionPath + " => " + indexPath, { verbose: true });
          return Promise.resolve();
        })
        .catch(function(err) {
          that._client.end();
          return Promise.reject(err);
        })
      } else {
        return Promise.reject('REVISION <' + revisionKey + '> NOT FOUND!');
      }
    });
  },

  fetchRevisions: function(options) {
    var that   = this;
    
    return that._establishSftp(options).then(function(sftp) {
      return new Promise(function(resolve, reject) {
        sftp.readdir(options.remoteDir, function(err, list) {
          if (err) {
            that._client.end();
            reject(err);
          }
          else {
            var revisions = that._extractRevisionsFromFileList(list, options.filePattern);

            if (options.autoClose) {
              that._client.end();
            }

            resolve(revisions);
          }
        });
      });
    });
  },

  _establishSftp: function(options) {
    var that   = this;
    var plugin = that._plugin;
    var client = that._client;

    return that._connect(options).then(function() {
      return new Promise(function(resolve, reject) {
        plugin.log('Attempting to establish an SFTP session', { verbose: true });
        client.sftp(function(err, sftp) {
          if (err) {
            client.end();
            reject(err);
          }
          else {
            plugin.log('SFTP session established', { verbose: true });
            that._sftp = sftp;
            resolve(sftp);
          }
        });
      });
    });
  },

  _connect: function(options) {
    var plugin = this._plugin;
    var client = this._client;
    var ssh_config = {
      host: options.host,
      username: options.username,
      port: options.port || '22',
      agent: options.agent,
      passphrase: options.passphrase,
      privateKey: options.privateKeyFile ? fs.readFileSync(untildify(options.privateKeyFile)) : null
    };

    return new Promise(function(resolve, reject) {
      client.on('ready', function () {
        plugin.log('Successfully connected to remote host', { verbose: true });
        resolve();
      });

      client.on('error', function (error) {
        reject(error);
      });

      plugin.log('Attempting to connect to remote host: ' +
        ssh_config.username + '@' + ssh_config.host + ':' + ssh_config.port,
        { verbose: true });

      client.connect(ssh_config);
    });
  },

  _extractRevisionsFromFileList: function(fileList, filePattern) {
    var revisionRegex = new RegExp(filePattern + ':(.*)');
    var filename, current;
    var revisions = fileList.filter(function(item) {
      filename = item.filename;

      if (filename.indexOf(ACTIVE_REVISION_EXT) !== -1) {
        current = filename.split('.')[0];
      }

      return revisionRegex.test(filename);
    })
    .map(function(rev) {
      var revision = revisionRegex.exec(rev.filename)[1];
      var active = revision === current;

      return {
        revision: revision,
        timestamp: new Date(rev.attrs.mtime * 1000), // convert unix timestamp to JS date
        active: active
      };
    })
    .sort(function(a, b) {
      return b.timestamp - a.timestamp;
    });

    return revisions;
  },

  _validateRevision: function(revisions, revisionKey, allowOverwrite) {
    var revisionExists = this._revisionExists(revisions, revisionKey);

    if (revisionExists && !allowOverwrite) {
      return Promise.reject('REVISION <' + revisionKey + '> ALREADY UPLOADED! (set `allowOverwrite: true` if you want to support overwriting revisions)');
    }

    return Promise.resolve();
  },

  _revisionExists: function(revisions, revisionKey) {
    var revisionExists = false;

    for (var i = 0, len = revisions.length; i < len; i++) {
      if (revisions[i].revision === revisionKey) {
        revisionExists = true;
        break;
      }
    }

    return revisionExists;
  },

  _writeFile: function(fileContents, filename) {
    var that   = this;
    var plugin = that._plugin;

    return new Promise(function(resolve, reject) {
      var stream = that._sftp.createWriteStream(filename);
      stream.on('error', reject);
      stream.on('end', reject);
      stream.on('close', resolve);

      plugin.log('Writing ' + filename + ' to remote host', { verbose: true });

      stream.write(fileContents);
      stream.end();
    });
  },

  _copyFile: function(fromFile, toFile) {
    var client = this._client;

    return new Promise(function(resolve, reject) {
      client.exec('cp ' + fromFile + ' ' + toFile, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  _markActiveRevision: function(remoteDir, revisionKey) {
    var client = this._client;

    return new Promise(function(resolve, reject) {
      client.exec('rm ' + path.join(remoteDir, '*' + ACTIVE_REVISION_EXT) +
        ' && touch ' + path.join(remoteDir, revisionKey + ACTIVE_REVISION_EXT),
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
      });
    });
  }
})
