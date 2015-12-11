var CoreObject = require('core-object');
var Promise    = require('ember-cli/lib/ext/promise');
var ssh2       = require('ssh2');
var fs         = require('fs');

module.exports = CoreObject.extend({
  init: function(options) {
    var plugin = options.plugin;

    this._plugin = plugin;
    this._client = new ssh2.Client();
  },

  upload: function(options) {

  },

  activate: function(options) {

  },

  fetchRevisions: function(options) {
    var plugin = this._plugin;
    var client = this._client;

    return this._establishSftp(options).then(function(sftp) {
      return new Promise(function(resolve, reject) {
        plugin.log('Reading remote directory: ' + options.remoteDir, { verbose: true });
        sftp.readdir(options.remoteDir, function(err, list) {
          if (err) { reject(err); }
          else {
            var filename, current;
            var revisions = list.filter(function(item) {
              filename = item.filename;

              if (filename.indexOf('.active-revision') !== -1) {
                current = filename.split('.')[0];
              }

              return filename.indexOf('index::') !== -1;
            }).map(function(rev) {
              var revision = rev.filename.match(/index::(.*).html/)[1];
              var active = revision === current;

              return {
                revision: revision,
                timestamp: new Date(rev.attrs.mtime * 1000), // convert unix timestamp to JS date
                active: active
              };
            });

            resolve(revisions);
          }
        });
      });
    });
  },

  _establishSftp: function(options) {
    var _this = this;

    return _this._connect(options).then(function() {
      return new Promise(function(resolve, reject) {
        _this._client.sftp(function(err, sftp) {
          if (err) { reject(err); }
          else {
            resolve(sftp);
          }
        });
      });
    });
  },

  _connect: function(options) {
    var client = this._client;
    var ssh_config = {
      host: options.host,
      username: options.username,
      port: options.port || '22',
      agent: options.agent,
      passphrase: options.passphrase,
      privateKey: fs.readFileSync(options.privateKeyFile)
    };

    return new Promise(function(resolve, reject) {
      client.on('ready', function () {
        resolve();
      });

      client.on('error', function (error) {
        reject(error);
      });

      client.connect(ssh_config);
    });
  }
})
