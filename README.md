log4js-gelf
===========

[GELF](http://www.graylog2.org/about/gelf) format appender for
[log4js-node](http://github.com/nomiddlename/log4js-node). Requires
log4js version 0.7 or later to use. NOTE: log4js 0.7 has not yet been released. If you're using log4js 0.6.x you don't need this module, the gelf appender is already included.

Installation
------------

    npm install log4js log4js-gelf
    
Usage
-----

Once installed, configure it as part of the log4js initialisation:

    var log4js = require('log4js');
    log4js.configure({
        appenders: {
            "gelf": { 
                type: "log4js-gelf",
                host: "gelf.host",
                port: 1234,
                hostname: "node-server",
                facility: "myapp"
            }
        },
        categories: {
            "default": { level: "DEBUG", appenders: [ "gelf" ] }
        }
    });
    
The GELF appender will log events via UDP to the configured server.
    
Options
-------
* `host` (String) - hostname of your GELF/graylog2 server where the
  log messages will be sent (default: localhost)
* `port` (Number) - port number your GELF server is listening on
  (default: 12201)
* `hostname` (String) - hostname of the running app (default: os
  hostname)
* `facility` (String) - the facility to log to (default:
  nodejs-server)
* `customFields` (Object) - a set of keys and values to add to all log
  messages. Keys should start with underscore, otherwise they will be
  ignored. These values can be overridden by providing the first
  argument to `logger.debug` (etc) as an object with a `GELF`
  property. e.g.
  
      logger.info({ GELF: { _extra: "thing" } }, "rest of log
      message");

* `layout` (Object) - log4js standard layout config (default: message pass
  through layout)

Author
------
The GELF appender was originally contributed to log4js by
[Arif Amirani](http://github.com/arifamirani).

License
-------
Apache 2.
