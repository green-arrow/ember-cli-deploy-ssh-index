const chai = require('chai');
const path = require('path');
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const assert = chai.assert;

describe('ssh', function() {
  let  Ssh, mockUi, plugin, subject, options, mockSftpStream, mockSftp, mockSsh2;

  let date1 = new Date('December 11, 2015 01:00:00');
  let date2 = new Date('December 11, 2015 02:00:00');

  before(function() {
    Ssh = require('../../../lib/ssh');
  });

  beforeEach(function() {
    let remoteHostFileList = [
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
          let s3Client = propertyName;
          return s3Client
        }
      },
      log: function(message) {
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
    let ssh2Params;
    let filePattern = 'test.html';
    let revisionKey = 'some-revision-key';
    let username    = 'some-username';
    let host        = 'some-host';
    let remoteDir   = '/directory';
    let agent       = 'some-agent';
    let passphrase  = 'some-passphrase';
    let dummyFile   = 'tests/unit/fixtures/test.html';

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
      let promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
          let expectLogOutput = '- ✔  ' + path.join(remoteDir, filePattern + ':' + revisionKey);

          assert.ok(mockUi.messages.length > 0, 'At least one line logged');
          assert.equal(mockUi.messages[mockUi.messages.length - 1], expectLogOutput,
            'Last line of log output correct');
        });
    });

    it('rejects if upload fails', function() {
      mockSftpStream.end = function() {
        this.events.error();
      }

      let promise = subject.upload(options);

      return assert.isRejected(promise);
    });

    it('ends the connection after uploading', function() {
      let ended = false;

      mockSsh2.end = function() {
        ended = true;
      }

      let promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
          assert.ok(ended, 'connection ended');
        })
    });

    it('passes expected parameters to the ssh2', function() {

      let promise = subject.upload(options);

      return assert.isFulfilled(promise)
        .then(function() {
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
        let promise = subject.upload(options);

        return assert.isRejected(promise);
      });

      it('does not reject when allowOverwrite option is set to true', function() {
        options.allowOverwrite = true;

        let promise = subject.upload(options);

        return assert.isFulfilled(promise);
      });
    });
  });

  describe('#fetchRevisions', function() {
    let filePattern = 'test.html';
    let username    = 'some-username';
    let host        = 'some-host';
    let remoteDir   = '/directory';
    let agent       = 'some-agent';
    let passphrase  = 'some-passphrase';
    let dummyFile   = 'tests/unit/fixtures/test.html';

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
      let promise = subject.fetchRevisions(options);
      let expected = [
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
    let executedCommands = []
    let filePattern      = 'test.html';
    let username         = 'some-username';
    let host             = 'some-host';
    let remoteDir        = '/directory';
    let agent            = 'some-agent';
    let passphrase       = 'some-passphrase';
    let dummyFile        = 'tests/unit/fixtures/test.html';

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
        let promise = subject.activate(options);

        return assert.isFulfilled(promise);
      });

      it('logs to the console when activation was successful', function() {
        let promise = subject.activate(options);
        let expectLogOutput = '- ✔  ' + path.join(remoteDir, filePattern + ':' + options.revisionKey) +
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
        let promise = subject.activate(options);

        return assert.isRejected(promise);
      });
    });
  });
});
