"use strict";
var should = require('should')
, sandbox = require('sandboxed-module')
, setupLogging = function(options, category, compressedLength) {
  var fakeDgram = {
    sent: false,
    socket: {
      packetLength: 0,
      closed: false,
      close: function() {
        this.closed = true;
      },
      send: function(pkt, offset, pktLength, port, host) {
        fakeDgram.sent = true;
        this.packet = pkt;
        this.offset = offset;
        this.packetLength = pktLength;
        this.port = port;
        this.host = host;
      }
    },
    createSocket: function(type) {
      this.type = type;
      return this.socket;
    }
  }
  , fakeZlib = {
    gzip: function(objectToCompress, callback) {
      fakeZlib.uncompressed = objectToCompress;
      if (this.shouldError) {
        callback({ stack: "oh noes" });
        return;
      }

      if (compressedLength) {
        callback(null, { length: compressedLength });
      } else {
        callback(null, "I've been compressed");
      }
    }
  }
  , exitHandler
  , fakeConsole = {
    error: function(message) {
      this.message = message;
    }
  }
  , fakeLayouts = {
    layout: function(type, options) {
      this.type = type;
      this.options = options;
      return this.messagePassThroughLayout;
    },
    messagePassThroughLayout: function(evt) { return evt.data[0]; }
  }
  , appender = sandbox.require('../lib', {
    requires: {
      dgram: fakeDgram,
      zlib: fakeZlib
    },
    globals: {
      process: {
        on: function(evt, handler) {
          if (evt === 'exit') {
            exitHandler = handler;
          }
        }
      },
      console: fakeConsole
    }
  })(fakeLayouts, { INFO: "info" })
  , gelfAppender = appender(options || {});
 
  return {
    dgram: fakeDgram,
    compress: fakeZlib,
    exitHandler: exitHandler,
    console: fakeConsole,
    layouts: fakeLayouts,
    gelfAppender: gelfAppender
  };
};

describe('log4js gelfAppender', function() {
  
  describe('with default gelfAppender settings', function() {
    var test;

    before(function() {
      test = setupLogging();
      test.gelfAppender(
        {
          level: "info",
          data: [ "This is a test" ]
        }
      );
    });

    it('should send the dgram packet via udp to localhost', function() {
      test.dgram.type.should.eql("udp4");
      test.dgram.socket.host.should.eql("localhost");
      test.dgram.socket.port.should.eql(12201);
      test.dgram.socket.offset.should.eql(0);
      test.dgram.socket.packetLength.should.be.greaterThan(0);
    });

    it('should compress the dgram packet', function() {
      test.dgram.socket.packet.should.eql("I've been compressed");
    });

    it('should use the gelf format for the uncompressed log message', function() {
      var message = JSON.parse(test.compress.uncompressed);

      message.version.should.eql('1.0');
      message.host.should.eql(require('os').hostname());
      message.level.should.eql(6); //INFO
      message.facility.should.eql('nodejs-server');
      message.full_message.should.eql(message.short_message);
      message.full_message.should.eql('This is a test');
    });
  });

  describe('with a message longer than 8k', function() {
    var test;
    before(function() {
      test = setupLogging(undefined, undefined, 10240);
      test.gelfAppender({
        level: "info",
        data: [ "Blah." ]
      });
    });

    it('should not send the dgram packet', function() {
      test.dgram.sent.should.be.false;
    });
  });

  describe('with non-default options', function() {
    var test;

    before(function() {
      test = setupLogging({
        host: 'somewhere',
        port: 12345,
        hostname: 'cheese',
        facility: 'nonsense'
      });
      test.gelfAppender({
          level: "debug",
          data: [ "Just testing." ]
      });
    });

    it('should pass the options to the dgram packet', function() {
      test.dgram.socket.host.should.eql('somewhere');
      test.dgram.socket.port.should.eql(12345);
    });

    it('should pass the options to the uncompressed packet', function() {
      var message = JSON.parse(test.compress.uncompressed);
      message.host.should.eql('cheese');
      message.facility.should.eql('nonsense');
    });
  });

  describe('on process.exit', function() {
    it('should close open sockets', function() {
      var test = setupLogging();
      test.exitHandler();
      test.dgram.socket.closed.should.be.true;
    });
  });

  describe('on zlib error', function() {
    it('should output to console.error', function() {
      var test = setupLogging();
      test.compress.shouldError = true;
      test.gelfAppender({
        level: "info",
        data: [ 'whatever' ]
      });
      test.console.message.should.eql('oh noes');
    });
  });

  describe('with layout in configuration', function() {
    it('should pass options to layout', function() {
      var test = setupLogging({
        layout: {
          type: 'madeuplayout',
          earlgrey: 'yes, please'
        }
      });

      test.layouts.type.should.eql('madeuplayout');
      test.layouts.options.earlgrey.should.eql('yes, please');
    });
  });


  describe('with custom fields options', function() {
    var test;

    before(function() {
      test = setupLogging({
        host: 'somewhere',
        port: 12345,
        hostname: 'cheese',
        facility: 'nonsense',
        customFields: {
          _every1: 'Hello every one',
          _every2: 'Hello every two'
        }
      });
      var myFields = {
        GELF: true,
        _every2: 'Overwritten!',
        _myField: 'This is my field!'
      };
      test.gelfAppender({
        level: "debug",
        data: [ myFields, "Just testing." ]
      });
    });

    describe('the dgram packet', function() {
      it('should pick up the options', function() {
        test.dgram.socket.host.should.eql('somewhere');
        test.dgram.socket.port.should.eql(12345);
      });
    });

    describe('the uncompressed packet', function() {
      it('should pick up the options', function() {
        var message = JSON.parse(test.compress.uncompressed);
        message.host.should.eql('cheese');
        message.facility.should.eql('nonsense');
        message._every1.should.eql('Hello every one'); // the default value
        message._every2.should.eql('Overwritten!'); // the overwritten value
        message._myField.should.eql('This is my field!'); // the value for this message only
        message.short_message.should.eql('Just testing.'); // skip the field object 
        message.full_message.should.eql('Just testing.'); // should be as same as short_message 
      });
    });
  });
});
