var assert = require('ember-cli/tests/helpers/assert');
var path   = require('path');

describe('ssh', function() {
  var Ssh, mockUi, plugin, subject, options;

  var date1 = new Date('December 11, 2015 01:00:00');
  var date2 = new Date('December 11, 2015 02:00:00');

  before(function() {
    Ssh = require('../../../lib/ssh');
  });

  beforeEach(function() {
    remoteHostFileList = [
      { filename: '123.active-revision', attrs: { mtime: date1.getTime() / 1000 } },
      { filename: 'test.html',           attrs: { mtime: date1.getTime() / 1000 } },
      { filename: 'test.html:123',       attrs: { mtime: date1.getTime() / 1000 } },
      { filename: 'test.html:456',       attrs: { mtime: date2.getTime() / 1000 } }
    ];

    mockUi = {
      messages: [],
      write: function() {},
      writeLine: function(message) {
        this.messages.push(message);
      }
    };

    plugin = {
      ui: mockUi,
      readConfig: function(propertyName) {
        if (propertyName === 's3Client') {
          return s3Client;
        }
      },
      log: function(message, opts) {
        this.ui.write('|    ');
        this.ui.writeLine('- ' + message);
      }
    };

    mockSftpStream = {
      events: {},
      on: function(eventName, cb) {
        this.events[eventName] = cb;
      },
      write: function() {},
      end: function() {
        this.events.close();
      }
    };

    mockSftp = {
      readdir: function(remoteDir, cb) {
        cb(null, remoteHostFileList);
      },
      createWriteStream: function() {
        return mockSftpStream;
      }
    };

    mockSsh2 = {
      events: {},
      on: function(eventName, cb) {
        this.events[eventName] = cb;
      },
      connect: function() {
        this.events.ready();
      },
      sftp: function(cb) {
        cb(null, mockSftp);
      },
      end: function() {}
    }

    subject = new Ssh({
      plugin: plugin
    });

    subject._client = mockSsh2;
  });

  describe('#upload', function() {
    var ssh2Params;
    var filePattern = 'test.html';
    var revisionKey = 'some-revision-key';
    var username    = 'some-username';
    var host        = 'some-host';
    var remoteDir   = '/directory';
    var agent       = 'some-agent';
    var passphrase  = 'some-passphrase';
    var dummyFile   = 'tests/unit/fixtures/test.html';

    beforeEach(function() {
      options = {
        allowOverwrite: false,
        filePattern: filePattern,
        revisionKey: revisionKey,
        filePath: dummyFile,
        privateKeyFile: dummyFile,
        username: username,
        host: host,
        remoteDir: remoteDir,
        agent: agent,
        passphrase: passphrase
      };

      mockSsh2.connect = function(options) {
        ssh2Params = options;
        this.events.ready();
      }
    });

    it('resolves if upload succeeds', function() {
      var promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
          var expectLogOutput = '- ✔  ' + path.join(remoteDir, filePattern + ':' + revisionKey);

          assert.ok(mockUi.messages.length > 0, 'At least one line logged');
          assert.equal(mockUi.messages[mockUi.messages.length - 1], expectLogOutput,
            'Last line of log output correct');
        });
    });

    it('rejects if upload fails', function() {
      mockSftpStream.end = function() {
        this.events.error();
      }

      var promise = subject.upload(options);

      return assert.isRejected(promise);
    });

    it('ends the connection after uploading', function() {
      var ended = false;

      mockSsh2.end = function() {
        ended = true;
      }

      var promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(ended, 'connection ended');
        })
    });

    it('passes expected parameters to the ssh2', function() {

      var promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
          var expectedKey = filePattern+':'+revisionKey;
          var defaultACL  = 'public-read';

          assert.equal(ssh2Params.host, host, 'host passed correctly');
          assert.equal(ssh2Params.username, username, 'username passed correctly');
          assert.equal(ssh2Params.port, '22', 'port defaults correctly');
          assert.equal(ssh2Params.agent, agent, 'agent passed correctly');
          assert.equal(ssh2Params.passphrase, passphrase, 'passphrase correctly');
          assert.ok(ssh2Params.privateKey, 'privateKey is set');
        });
    });

    describe("when revisionKey was already uploaded", function() {
      beforeEach(function() {
        options.revisionKey = "123";
      });

      it('rejects when trying to upload an already uploaded revision', function() {
        var promise = subject.upload(options);

        return assert.isRejected(promise);
      });

      it('does not reject when allowOverwrite option is set to true', function() {
        options.allowOverwrite = true;

        var promise = subject.upload(options);

        return assert.isFulfilled(promise);
      });
    });
  });

  describe('#fetchRevisions', function() {
    var filePattern = 'test.html';
    var username    = 'some-username';
    var host        = 'some-host';
    var remoteDir   = '/directory';
    var agent       = 'some-agent';
    var passphrase  = 'some-passphrase';
    var dummyFile   = 'tests/unit/fixtures/test.html';

    beforeEach(function() {
      options = {
        filePattern: filePattern,
        username: username,
        host: host,
        agent: agent,
        passphrase: passphrase,
        remoteDir: remoteDir,
        privateKeyFile: dummyFile
      };
    });

    it('returns an array of uploaded revisions in `{ revision: revisionKey, timestamp: timestamp, active: active }` format sorted by date in descending order', function() {
      var promise = subject.fetchRevisions(options);
      var expected = [
          { revision: '456', timestamp: date2, active: false },
          { revision: '123', timestamp: date1, active: true }
      ];

      return assert.isFulfilled(promise)
        .then(function(revisionsData) {
          return assert.deepEqual(revisionsData, expected, 'Revisions data correct');
        });
    });
  });

  describe('#activate', function() {
    var executedCommands = []
    var filePattern      = 'test.html';
    var username         = 'some-username';
    var host             = 'some-host';
    var remoteDir        = '/directory';
    var agent            = 'some-agent';
    var passphrase       = 'some-passphrase';
    var dummyFile        = 'tests/unit/fixtures/test.html';

    beforeEach(function() {
      options = {
        filePattern: filePattern,
        username: username,
        host: host,
        agent: agent,
        passphrase: passphrase,
        remoteDir: remoteDir,
        privateKeyFile: dummyFile
      };

      mockSsh2.exec = function(cmd, cb) {
        executedCommands.push(cmd);
        cb();
      }
    });

    describe('with a valid revisionKey', function() {
      beforeEach(function() {
        options.revisionKey = '456';
      });

      it('resolves when passing an existing revisionKey', function() {
        var promise = subject.activate(options);

        return assert.isFulfilled(promise);
      });

      it('logs to the console when activation was successful', function() {
        var promise = subject.activate(options);
        var expectLogOutput = '- ✔  ' + path.join(remoteDir, filePattern + ':' + options.revisionKey) +
          ' => ' + path.join(remoteDir, filePattern);

        return assert.isFulfilled(promise)
          .then(function() {
            assert.ok(mockUi.messages.length > 0, 'At least one line logged');
            assert.equal(mockUi.messages[mockUi.messages.length - 1], expectLogOutput,
              'Last line of log output correct');
          });
      });
    });

    describe('with an invalid revision key', function() {
      beforeEach(function() {
        options.revisionKey = '457';
      });

      it('rejects when passing an non-existing revisionKey', function() {
        var promise = subject.activate(options);

        return assert.isRejected(promise);
      });
    });
  });
});
