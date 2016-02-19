(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Browser Request
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// UMD HEADER START 
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.returnExports = factory();
  }
}(this, function () {
// UMD HEADER END

var XHR = XMLHttpRequest
if (!XHR) throw new Error('missing XMLHttpRequest')
request.log = {
  'trace': noop, 'debug': noop, 'info': noop, 'warn': noop, 'error': noop
}

var DEFAULT_TIMEOUT = 3 * 60 * 1000 // 3 minutes

//
// request
//

function request(options, callback) {
  // The entry-point to the API: prep the options object and pass the real work to run_xhr.
  if(typeof callback !== 'function')
    throw new Error('Bad callback given: ' + callback)

  if(!options)
    throw new Error('No options given')

  var options_onResponse = options.onResponse; // Save this for later.

  if(typeof options === 'string')
    options = {'uri':options};
  else
    options = JSON.parse(JSON.stringify(options)); // Use a duplicate for mutating.

  options.onResponse = options_onResponse // And put it back.

  if (options.verbose) request.log = getLogger();

  if(options.url) {
    options.uri = options.url;
    delete options.url;
  }

  if(!options.uri && options.uri !== "")
    throw new Error("options.uri is a required argument");

  if(typeof options.uri != "string")
    throw new Error("options.uri must be a string");

  var unsupported_options = ['proxy', '_redirectsFollowed', 'maxRedirects', 'followRedirect']
  for (var i = 0; i < unsupported_options.length; i++)
    if(options[ unsupported_options[i] ])
      throw new Error("options." + unsupported_options[i] + " is not supported")

  options.callback = callback
  options.method = options.method || 'GET';
  options.headers = options.headers || {};
  options.body    = options.body || null
  options.timeout = options.timeout || request.DEFAULT_TIMEOUT

  if(options.headers.host)
    throw new Error("Options.headers.host is not supported");

  if(options.json) {
    options.headers.accept = options.headers.accept || 'application/json'
    if(options.method !== 'GET')
      options.headers['content-type'] = 'application/json'

    if(typeof options.json !== 'boolean')
      options.body = JSON.stringify(options.json)
    else if(typeof options.body !== 'string')
      options.body = JSON.stringify(options.body)
  }
  
  //BEGIN QS Hack
  var serialize = function(obj) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    return str.join("&");
  }
  
  if(options.qs){
    var qs = (typeof options.qs == 'string')? options.qs : serialize(options.qs);
    if(options.uri.indexOf('?') !== -1){ //no get params
        options.uri = options.uri+'&'+qs;
    }else{ //existing get params
        options.uri = options.uri+'?'+qs;
    }
  }
  //END QS Hack
  
  //BEGIN FORM Hack
  var multipart = function(obj) {
    //todo: support file type (useful?)
    var result = {};
    result.boundry = '-------------------------------'+Math.floor(Math.random()*1000000000);
    var lines = [];
    for(var p in obj){
        if (obj.hasOwnProperty(p)) {
            lines.push(
                '--'+result.boundry+"\n"+
                'Content-Disposition: form-data; name="'+p+'"'+"\n"+
                "\n"+
                obj[p]+"\n"
            );
        }
    }
    lines.push( '--'+result.boundry+'--' );
    result.body = lines.join('');
    result.length = result.body.length;
    result.type = 'multipart/form-data; boundary='+result.boundry;
    return result;
  }
  
  if(options.form){
    if(typeof options.form == 'string') throw('form name unsupported');
    if(options.method === 'POST'){
        var encoding = (options.encoding || 'application/x-www-form-urlencoded').toLowerCase();
        options.headers['content-type'] = encoding;
        switch(encoding){
            case 'application/x-www-form-urlencoded':
                options.body = serialize(options.form).replace(/%20/g, "+");
                break;
            case 'multipart/form-data':
                var multi = multipart(options.form);
                //options.headers['content-length'] = multi.length;
                options.body = multi.body;
                options.headers['content-type'] = multi.type;
                break;
            default : throw new Error('unsupported encoding:'+encoding);
        }
    }
  }
  //END FORM Hack

  // If onResponse is boolean true, call back immediately when the response is known,
  // not when the full request is complete.
  options.onResponse = options.onResponse || noop
  if(options.onResponse === true) {
    options.onResponse = callback
    options.callback = noop
  }

  // XXX Browsers do not like this.
  //if(options.body)
  //  options.headers['content-length'] = options.body.length;

  // HTTP basic authentication
  if(!options.headers.authorization && options.auth)
    options.headers.authorization = 'Basic ' + b64_enc(options.auth.username + ':' + options.auth.password);

  return run_xhr(options)
}

var req_seq = 0
function run_xhr(options) {
  var xhr = new XHR
    , timed_out = false
    , is_cors = is_crossDomain(options.uri)
    , supports_cors = ('withCredentials' in xhr)

  req_seq += 1
  xhr.seq_id = req_seq
  xhr.id = req_seq + ': ' + options.method + ' ' + options.uri
  xhr._id = xhr.id // I know I will type "_id" from habit all the time.

  if(is_cors && !supports_cors) {
    var cors_err = new Error('Browser does not support cross-origin request: ' + options.uri)
    cors_err.cors = 'unsupported'
    return options.callback(cors_err, xhr)
  }

  xhr.timeoutTimer = setTimeout(too_late, options.timeout)
  function too_late() {
    timed_out = true
    var er = new Error('ETIMEDOUT')
    er.code = 'ETIMEDOUT'
    er.duration = options.timeout

    request.log.error('Timeout', { 'id':xhr._id, 'milliseconds':options.timeout })
    return options.callback(er, xhr)
  }

  // Some states can be skipped over, so remember what is still incomplete.
  var did = {'response':false, 'loading':false, 'end':false}

  xhr.onreadystatechange = on_state_change
  xhr.open(options.method, options.uri, true) // asynchronous
  if(is_cors)
    xhr.withCredentials = !! options.withCredentials
  xhr.send(options.body)
  return xhr

  function on_state_change(event) {
    if(timed_out)
      return request.log.debug('Ignoring timed out state change', {'state':xhr.readyState, 'id':xhr.id})

    request.log.debug('State change', {'state':xhr.readyState, 'id':xhr.id, 'timed_out':timed_out})

    if(xhr.readyState === XHR.OPENED) {
      request.log.debug('Request started', {'id':xhr.id})
      for (var key in options.headers)
        xhr.setRequestHeader(key, options.headers[key])
    }

    else if(xhr.readyState === XHR.HEADERS_RECEIVED)
      on_response()

    else if(xhr.readyState === XHR.LOADING) {
      on_response()
      on_loading()
    }

    else if(xhr.readyState === XHR.DONE) {
      on_response()
      on_loading()
      on_end()
    }
  }

  function on_response() {
    if(did.response)
      return

    did.response = true
    request.log.debug('Got response', {'id':xhr.id, 'status':xhr.status})
    clearTimeout(xhr.timeoutTimer)
    xhr.statusCode = xhr.status // Node request compatibility

    // Detect failed CORS requests.
    if(is_cors && xhr.statusCode == 0) {
      var cors_err = new Error('CORS request rejected: ' + options.uri)
      cors_err.cors = 'rejected'

      // Do not process this request further.
      did.loading = true
      did.end = true

      return options.callback(cors_err, xhr)
    }

    options.onResponse(null, xhr)
  }

  function on_loading() {
    if(did.loading)
      return

    did.loading = true
    request.log.debug('Response body loading', {'id':xhr.id})
    // TODO: Maybe simulate "data" events by watching xhr.responseText
  }

  function on_end() {
    if(did.end)
      return

    did.end = true
    request.log.debug('Request done', {'id':xhr.id})

    xhr.body = xhr.responseText
    if(options.json) {
      try        { xhr.body = JSON.parse(xhr.responseText) }
      catch (er) { return options.callback(er, xhr)        }
    }

    options.callback(null, xhr, xhr.body)
  }

} // request

request.withCredentials = false;
request.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;

//
// defaults
//

request.defaults = function(options, requester) {
  var def = function (method) {
    var d = function (params, callback) {
      if(typeof params === 'string')
        params = {'uri': params};
      else {
        params = JSON.parse(JSON.stringify(params));
      }
      for (var i in options) {
        if (params[i] === undefined) params[i] = options[i]
      }
      return method(params, callback)
    }
    return d
  }
  var de = def(request)
  de.get = def(request.get)
  de.post = def(request.post)
  de.put = def(request.put)
  de.head = def(request.head)
  return de
}

//
// HTTP method shortcuts
//

var shortcuts = [ 'get', 'put', 'post', 'head' ];
shortcuts.forEach(function(shortcut) {
  var method = shortcut.toUpperCase();
  var func   = shortcut.toLowerCase();

  request[func] = function(opts) {
    if(typeof opts === 'string')
      opts = {'method':method, 'uri':opts};
    else {
      opts = JSON.parse(JSON.stringify(opts));
      opts.method = method;
    }

    var args = [opts].concat(Array.prototype.slice.apply(arguments, [1]));
    return request.apply(this, args);
  }
})

//
// CouchDB shortcut
//

request.couch = function(options, callback) {
  if(typeof options === 'string')
    options = {'uri':options}

  // Just use the request API to do JSON.
  options.json = true
  if(options.body)
    options.json = options.body
  delete options.body

  callback = callback || noop

  var xhr = request(options, couch_handler)
  return xhr

  function couch_handler(er, resp, body) {
    if(er)
      return callback(er, resp, body)

    if((resp.statusCode < 200 || resp.statusCode > 299) && body.error) {
      // The body is a Couch JSON object indicating the error.
      er = new Error('CouchDB error: ' + (body.error.reason || body.error.error))
      for (var key in body)
        er[key] = body[key]
      return callback(er, resp, body);
    }

    return callback(er, resp, body);
  }
}

//
// Utility
//

function noop() {}

function getLogger() {
  var logger = {}
    , levels = ['trace', 'debug', 'info', 'warn', 'error']
    , level, i

  for(i = 0; i < levels.length; i++) {
    level = levels[i]

    logger[level] = noop
    if(typeof console !== 'undefined' && console && console[level])
      logger[level] = formatted(console, level)
  }

  return logger
}

function formatted(obj, method) {
  return formatted_logger

  function formatted_logger(str, context) {
    if(typeof context === 'object')
      str += ' ' + JSON.stringify(context)

    return obj[method].call(obj, str)
  }
}

// Return whether a URL is a cross-domain request.
function is_crossDomain(url) {
  var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/

  // jQuery #8138, IE may throw an exception when accessing
  // a field from window.location if document.domain has been set
  var ajaxLocation
  try { ajaxLocation = location.href }
  catch (e) {
    // Use the href attribute of an A element since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
  }

  var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
    , parts = rurl.exec(url.toLowerCase() )

  var result = !!(
    parts &&
    (  parts[1] != ajaxLocParts[1]
    || parts[2] != ajaxLocParts[2]
    || (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? 80 : 443))
    )
  )

  //console.debug('is_crossDomain('+url+') -> ' + result)
  return result
}

// MIT License from http://phpjs.org/functions/base64_encode:358
function b64_enc (data) {
    // Encodes string using MIME base64 algorithm
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

    if (!data) {
        return data;
    }

    // assume utf8 data
    // data = this.utf8_encode(data+'');

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
        break;
        case 2:
            enc = enc.slice(0, -1) + '=';
        break;
    }

    return enc;
}
    return request;
//UMD FOOTER START
}));
//UMD FOOTER END

},{}],2:[function(require,module,exports){
function E () {
	// Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
	on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}],3:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _tasks = require("./components/tasks.js");

var _tasks2 = _interopRequireDefault(_tasks);

var _taskForm = require("./components/taskForm.js");

var _taskForm2 = _interopRequireDefault(_taskForm);

var _user = require("./components/user.js");

var _user2 = _interopRequireDefault(_user);

var _signin = require("./components/signin.js");

var _signin2 = _interopRequireDefault(_signin);

var _signup = require("./components/signup.js");

var _signup2 = _interopRequireDefault(_signup);

var _menu = require("./components/menu.js");

var _menu2 = _interopRequireDefault(_menu);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var App = function () {
  function App(body, footer) {
    _classCallCheck(this, App);

    this.signin = new _signin2.default(body);
    this.signup = new _signup2.default(body);
    this.tasks = new _tasks2.default(body);
    this.taskForm = new _taskForm2.default(body);
    this.user = new _user2.default(body);
    this.menu = new _menu2.default(footer);
  }

  _createClass(App, [{
    key: "init",
    value: function init() {
      this.signin.render();
      this.addEventListener();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.signinEvents();
      this.signupEvents();
      this.tasksEvents();
      this.taskFormEvents();
      this.userEvents();
      this.menuEvents();
    }
  }, {
    key: "signinEvents",
    value: function signinEvents() {
      var _this = this;

      this.signin.on("error", function () {
        return alert("Authentication error");
      });
      this.signin.on("signin", function (token) {
        localStorage.setItem("token", "JWT " + token);
        _this.menu.render("tasks");
        _this.tasks.render();
      });
      this.signin.on("signup", function () {
        return _this.signup.render();
      });
    }
  }, {
    key: "signupEvents",
    value: function signupEvents() {
      var _this2 = this;

      this.signup.on("error", function () {
        return alert("Register error");
      });
      this.signup.on("signup", function (user) {
        alert(user.name + " you were registered!");
        _this2.signin.render();
      });
    }
  }, {
    key: "tasksEvents",
    value: function tasksEvents() {
      var _this3 = this;

      this.tasks.on("error", function () {
        return alert("Task list error");
      });
      this.tasks.on("remove-error", function () {
        return alert("Task delete error");
      });
      this.tasks.on("update-error", function () {
        return alert("Task update error");
      });
      this.tasks.on("remove", function () {
        return _this3.tasks.render();
      });
      this.tasks.on("update", function () {
        return _this3.tasks.render();
      });
    }
  }, {
    key: "taskFormEvents",
    value: function taskFormEvents() {
      var _this4 = this;

      this.taskForm.on("error", function () {
        return alert("Task register error");
      });
      this.taskForm.on("submit", function () {
        _this4.menu.render("tasks");
        _this4.tasks.render();
      });
    }
  }, {
    key: "userEvents",
    value: function userEvents() {
      var _this5 = this;

      this.user.on("error", function () {
        return alert("User load error");
      });
      this.user.on("remove-error", function () {
        return alert("Cancel account error");
      });
      this.user.on("remove-account", function () {
        alert("So sad! You are leaving us :(");
        localStorage.clear();
        _this5.menu.clear();
        _this5.signin.render();
      });
    }
  }, {
    key: "menuEvents",
    value: function menuEvents() {
      var _this6 = this;

      this.menu.on("click", function (path) {
        _this6.menu.render(path);
        _this6[path].render();
      });
      this.menu.on("logout", function () {
        localStorage.clear();
        _this6.menu.clear();
        _this6.signin.render();
      });
    }
  }]);

  return App;
}();

module.exports = App;

},{"./components/menu.js":4,"./components/signin.js":5,"./components/signup.js":6,"./components/taskForm.js":7,"./components/tasks.js":8,"./components/user.js":9}],4:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _footer = require("../templates/footer.js");

var _footer2 = _interopRequireDefault(_footer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Menu = function (_NTask) {
  _inherits(Menu, _NTask);

  function Menu(body) {
    _classCallCheck(this, Menu);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Menu).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Menu, [{
    key: "render",
    value: function render(path) {
      this.body.innerHTML = _footer2.default.render(path);
      this.addEventListener();
    }
  }, {
    key: "clear",
    value: function clear() {
      this.body.innerHTML = "";
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.pathsClick();
      this.logoutClick();
    }
  }, {
    key: "pathsClick",
    value: function pathsClick() {
      var _this2 = this;

      var links = this.body.querySelectorAll("[data-path]");
      for (var i = 0, max = links.length; i < max; i++) {
        links[i].addEventListener("click", function (e) {
          e.preventDefault();
          var link = e.target.parentElement;
          var path = link.getAttribute("data-path");
          _this2.emit("click", path);
        });
      }
    }
  }, {
    key: "logoutClick",
    value: function logoutClick() {
      var _this3 = this;

      var link = this.body.querySelector("[data-logout]");
      link.addEventListener("click", function (e) {
        e.preventDefault();
        _this3.emit("logout");
      });
    }
  }]);

  return Menu;
}(_ntask2.default);

module.exports = Menu;

},{"../ntask.js":10,"../templates/footer.js":11}],5:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _signin = require("../templates/signin.js");

var _signin2 = _interopRequireDefault(_signin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Signin = function (_NTask) {
  _inherits(Signin, _NTask);

  function Signin(body) {
    _classCallCheck(this, Signin);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Signin).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Signin, [{
    key: "render",
    value: function render() {
      this.body.innerHTML = _signin2.default.render();
      this.body.querySelector("[data-email]").focus();
      this.addEventListener();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.formSubmit();
      this.signupClick();
    }
  }, {
    key: "formSubmit",
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector("form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = e.target.querySelector("[data-email]");
        var password = e.target.querySelector("[data-password]");
        var opts = {
          method: "POST",
          url: _this2.URL + "/token",
          json: true,
          body: {
            email: email.value,
            password: password.value
          }
        };
        _this2.request(opts, function (err, resp, data) {
          if (err || resp.status === 401) {
            _this2.emit("error", err);
          } else {
            _this2.emit("signin", data.token);
          }
        });
      });
    }
  }, {
    key: "signupClick",
    value: function signupClick() {
      var _this3 = this;

      var signup = this.body.querySelector("[data-signup]");
      signup.addEventListener("click", function (e) {
        e.preventDefault();
        _this3.emit("signup");
      });
    }
  }]);

  return Signin;
}(_ntask2.default);

module.exports = Signin;

},{"../ntask.js":10,"../templates/signin.js":12}],6:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _signup = require("../templates/signup.js");

var _signup2 = _interopRequireDefault(_signup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Signup = function (_NTask) {
  _inherits(Signup, _NTask);

  function Signup(body) {
    _classCallCheck(this, Signup);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Signup).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Signup, [{
    key: "render",
    value: function render() {
      this.body.innerHTML = _signup2.default.render();
      this.body.querySelector("[data-name]").focus();
      this.addEventListener();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.formSubmit();
    }
  }, {
    key: "formSubmit",
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector("form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = e.target.querySelector("[data-name]");
        var email = e.target.querySelector("[data-email]");
        var password = e.target.querySelector("[data-password]");
        var opts = {
          method: "POST",
          url: _this2.URL + "/users",
          json: true,
          body: {
            name: name.value,
            email: email.value,
            password: password.value
          }
        };
        _this2.request(opts, function (err, resp, data) {
          if (err || resp.status === 412) {
            _this2.emit("error", err);
          } else {
            _this2.emit("signup", data);
          }
        });
      });
    }
  }]);

  return Signup;
}(_ntask2.default);

module.exports = Signup;

},{"../ntask.js":10,"../templates/signup.js":13}],7:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _taskForm = require("../templates/taskForm.js");

var _taskForm2 = _interopRequireDefault(_taskForm);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TaskForm = function (_NTask) {
  _inherits(TaskForm, _NTask);

  function TaskForm(body) {
    _classCallCheck(this, TaskForm);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TaskForm).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(TaskForm, [{
    key: "render",
    value: function render() {
      this.body.innerHTML = _taskForm2.default.render();
      this.body.querySelector("[data-task]").focus();
      this.addEventListener();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.formSubmit();
    }
  }, {
    key: "formSubmit",
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector("form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var task = e.target.querySelector("[data-task]");
        var opts = {
          method: "POST",
          url: _this2.URL + "/tasks",
          json: true,
          headers: {
            authorization: localStorage.getItem("token")
          },
          body: {
            title: task.value
          }
        };
        _this2.request(opts, function (err, resp, data) {
          if (err || resp.status === 412) {
            _this2.emit("error");
          } else {
            _this2.emit("submit");
          }
        });
      });
    }
  }]);

  return TaskForm;
}(_ntask2.default);

module.exports = TaskForm;

},{"../ntask.js":10,"../templates/taskForm.js":14}],8:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _tasks = require("../templates/tasks.js");

var _tasks2 = _interopRequireDefault(_tasks);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Tasks = function (_NTask) {
  _inherits(Tasks, _NTask);

  function Tasks(body) {
    _classCallCheck(this, Tasks);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Tasks).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Tasks, [{
    key: "render",
    value: function render() {
      this.renderTaskList();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.taskDoneCheckbox();
      this.taskRemoveClick();
    }
  }, {
    key: "renderTaskList",
    value: function renderTaskList() {
      var _this2 = this;

      var opts = {
        method: "GET",
        url: this.URL + "/tasks",
        json: true,
        headers: {
          authorization: localStorage.getItem("token")
        }
      };
      this.request(opts, function (err, resp, data) {
        if (err) {
          _this2.emit("error", err);
        } else {
          _this2.body.innerHTML = _tasks2.default.render(data);
          _this2.addEventListener();
        }
      });
    }
  }, {
    key: "taskDoneCheckbox",
    value: function taskDoneCheckbox() {
      var _this3 = this;

      var dones = this.body.querySelectorAll("[data-done]");
      for (var i = 0, max = dones.length; i < max; i++) {
        dones[i].addEventListener("click", function (e) {
          e.preventDefault();
          var id = e.target.getAttribute("data-task-id");
          var done = e.target.getAttribute("data-task-done");
          var opts = {
            method: "PUT",
            url: _this3.URL + "/tasks/" + id,
            headers: {
              authorization: localStorage.getItem("token"),
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ done: !done })
          };
          _this3.request(opts, function (err, resp, data) {
            if (err || resp.status === 412) {
              _this3.emit("update-error", err);
            } else {
              _this3.emit("update");
            }
          });
        });
      }
    }
  }, {
    key: "taskRemoveClick",
    value: function taskRemoveClick() {
      var _this4 = this;

      var removes = this.body.querySelectorAll("[data-remove]");
      for (var i = 0, max = removes.length; i < max; i++) {
        removes[i].addEventListener("click", function (e) {
          e.preventDefault();
          if (confirm("Do you really wanna delete this task?")) {
            var id = e.target.getAttribute("data-task-id");
            var opts = {
              method: "DELETE",
              url: _this4.URL + "/tasks/" + id,
              headers: {
                authorization: localStorage.getItem("token")
              }
            };
            _this4.request(opts, function (err, resp, data) {
              if (err || resp.status === 412) {
                _this4.emit("remove-error", err);
              } else {
                _this4.emit("remove");
              }
            });
          }
        });
      }
    }
  }]);

  return Tasks;
}(_ntask2.default);

module.exports = Tasks;

},{"../ntask.js":10,"../templates/tasks.js":15}],9:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require("../ntask.js");

var _ntask2 = _interopRequireDefault(_ntask);

var _user = require("../templates/user.js");

var _user2 = _interopRequireDefault(_user);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var User = function (_NTask) {
  _inherits(User, _NTask);

  function User(body) {
    _classCallCheck(this, User);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(User).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(User, [{
    key: "render",
    value: function render() {
      this.renderUserData();
    }
  }, {
    key: "addEventListener",
    value: function addEventListener() {
      this.userCancelClick();
    }
  }, {
    key: "renderUserData",
    value: function renderUserData() {
      var _this2 = this;

      var opts = {
        method: "GET",
        url: this.URL + "/user",
        json: true,
        headers: {
          authorization: localStorage.getItem("token")
        }
      };
      this.request(opts, function (err, resp, data) {
        if (err || resp.status === 412) {
          _this2.emit("error", err);
        } else {
          _this2.body.innerHTML = _user2.default.render(data);
          _this2.addEventListener();
        }
      });
    }
  }, {
    key: "userCancelClick",
    value: function userCancelClick() {
      var _this3 = this;

      var button = this.body.querySelector("[data-remove-account]");
      button.addEventListener("click", function (e) {
        e.preventDefault();
        if (confirm("This will cancel your account, are you sure?")) {
          var opts = {
            method: "DELETE",
            url: _this3.URL + "/user",
            headers: {
              authorization: localStorage.getItem("token")
            }
          };
          _this3.request(opts, function (err, resp, data) {
            if (err || resp.status === 412) {
              _this3.emit("remove-error", err);
            } else {
              _this3.emit("remove-account");
            }
          });
        }
      });
    }
  }]);

  return User;
}(_ntask2.default);

module.exports = User;

},{"../ntask.js":10,"../templates/user.js":16}],10:[function(require,module,exports){
"use strict";

var _tinyEmitter = require("tiny-emitter");

var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

var _browserRequest = require("browser-request");

var _browserRequest2 = _interopRequireDefault(_browserRequest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NTask = function (_TinyEmitter) {
  _inherits(NTask, _TinyEmitter);

  function NTask() {
    _classCallCheck(this, NTask);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(NTask).call(this));

    _this.request = _browserRequest2.default;
    _this.URL = "https://localhost:3000";
    return _this;
  }

  return NTask;
}(_tinyEmitter2.default);

module.exports = NTask;

},{"browser-request":1,"tiny-emitter":2}],11:[function(require,module,exports){
"use strict";

exports.render = function (path) {
  var isTasks = path === "tasks" ? "active" : "";
  var isTaskForm = path === "taskForm" ? "active" : "";
  var isUser = path === "user" ? "active" : "";
  return "\n    <div class=\"tabs-striped tabs-color-calm\">\n      <div class=\"tabs\">\n        <a data-path=\"tasks\" class=\"tab-item " + isTasks + "\">\n          <i class=\"icon ion-home\"></i>\n        </a>\n        <a data-path=\"taskForm\" class=\"tab-item " + isTaskForm + "\">\n          <i class=\"icon ion-compose\"></i>\n        </a>\n        <a data-path=\"user\" class=\"tab-item " + isUser + "\">\n          <i class=\"icon ion-person\"></i>\n        </a>\n        <a data-logout class=\"tab-item\">\n          <i class=\"icon ion-android-exit\"></i>\n        </a>\n      </div>\n    </div>";
};

},{}],12:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Email</span>\n        <input type=\"text\" data-email>\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Password</span>\n        <input type=\"password\" data-password>\n      </label>\n    </div>\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-home\"></i> Login\n      </button>\n    </div>\n  </form>\n  <div class=\"padding\">\n    <button class=\"button button-block\" data-signup>\n      <i class=\"ion-person-add\"></i> Sign up\n    </button>\n  </div>";
};

},{}],13:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Name</span>\n        <input type=\"text\" data-name>\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Email</span>\n        <input type=\"text\" data-email>\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Password</span>\n        <input type=\"password\" data-password>\n      </label>\n    </div>\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-thumbsup\"></i> Register\n      </button>\n    </div>\n  </form>";
};

},{}],14:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Task</span>\n        <input type=\"text\" data-task>\n      </label>\n    </div>\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-compose\"></i> Add\n      </button>\n    </div>\n  </form>";
};

},{}],15:[function(require,module,exports){
"use strict";

var renderTasks = function renderTasks(tasks) {
  return tasks.map(function (task) {
    var done = task.done ? "ios-checkmark" : "ios-circle-outline";
    return "<li class=\"item item-icon-left item-button-right\">\n      <i class=\"icon ion-" + done + "\" data-done\n        data-task-done=\"" + (task.done ? 'done' : '') + "\"\n        data-task-id=\"" + task.id + "\"></i>\n      " + task.title + "\n      <button data-remove data-task-id=\"" + task.id + "\"\n        class=\"button button-assertive\">\n        <i class=\"ion-trash-a\"></i>\n      </button>\n    </li>";
  }).join("");
};
exports.render = function (tasks) {
  if (tasks && tasks.length) {
    return "<ul class=\"list\">" + renderTasks(tasks) + "</ul>";
  }
  return "<h4 class=\"text-center\">The task list is empty</h4>";
};

},{}],16:[function(require,module,exports){
"use strict";

exports.render = function (user) {
  return "<div class=\"list\">\n    <label class=\"item item-input item-stacked-label\">\n      <span class=\"input-label\">Name</span>\n      <small class=\"dark\">" + user.name + "</small>\n    </label>\n    <label class=\"item item-input item-stacked-label\">\n      <span class=\"input-label\">Email</span>\n      <small class=\"dark\">" + user.email + "</small>\n    </label>\n  </div>\n  <div class=\"padding\">\n    <button data-remove-account\n      class=\"button button-assertive button-block\">\n      <i class=\"ion-trash-a\"></i> Cancel account\n    </button>\n  </div>";
};

},{}],17:[function(require,module,exports){
"use strict";

var _app = require("./app.js");

var _app2 = _interopRequireDefault(_app);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.onload = function () {
  var main = document.querySelector("main");
  var footer = document.querySelector("footer");
  new _app2.default(main, footer).init();
};

},{"./app.js":3}]},{},[17]);
