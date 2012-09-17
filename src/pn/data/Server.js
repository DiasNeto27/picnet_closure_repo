﻿;
goog.provide('pn.data.Server');
goog.provide('pn.data.Server.Response');
goog.provide('pn.data.Server.Update');
goog.require('goog.debug.Logger');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('goog.net.XhrManager');
goog.require('goog.style');
goog.require('pn.app.AppEvents');
goog.require('pn.data.DataDownloader');
goog.require('pn.data.IDataSource');
goog.require('pn.data.TypeRegister');
goog.require('pn.json');
goog.require('pn.log');



/**
 * @constructor
 * @extends {goog.events.EventTarget}
 * @param {string} controller The controller Uri.
 */
pn.data.Server = function(controller) {
  goog.asserts.assert(goog.isString(controller));

  goog.events.EventTarget.call(this);

  /**
   * @private
   * @const
   * @type {string}
   */
  this.controller_ = controller;

  /**
   * @private
   * @type {goog.net.XhrManager}
   */
  this.manager_ = new goog.net.XhrManager(0);
  this.registerDisposable(this.manager_);

  /**
   * @private
   * @type {goog.debug.Logger}
   */
  this.log_ = pn.log.getLogger('pn.data.Server');

  /**
   * @private
   * @type {number}
   */
  this.requestCount_ = 0;
};
goog.inherits(pn.data.Server, goog.events.EventTarget);


/**
 * @param {string} controller The controller name for the ajax request.
 * @param {string} action The controller action name for the request.
 * @param {!Object} data The data for the server ajax request.  Ensure that
 *    this is using safe compiled object keys (strings).
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.ajax =
    function(controller, action, data, lastUpdate, success, failure) {
  goog.asserts.assert(goog.isString(controller));
  goog.asserts.assert(goog.isString(action));
  goog.asserts.assert(goog.isObject(data));
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var ajaxData = {
    'controller': controller,
    'action': action,
    'dataJson': pn.json.serialiseJson(data),
    'lastUpdate': lastUpdate
  };
  this.ajax_('Ajax', ajaxData, success, failure);
};


/**
 * @param {!pn.data.Entity} entity The entity to create.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.createEntity =
    function(entity, lastUpdate, success, failure) {
  goog.asserts.assert(entity instanceof pn.data.Entity);
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = this.getEntityJson_(entity, lastUpdate);
  this.ajax_('CreateEntity', json, success, failure);
};


/**
 * @param {!pn.data.Entity} entity The entity to update.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.updateEntity =
    function(entity, lastUpdate, success, failure) {
  goog.asserts.assert(entity instanceof pn.data.Entity);
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = this.getEntityJson_(entity, lastUpdate);
  this.ajax_('UpdateEntity', json, success, failure);
};


/**
 * @param {!pn.data.Entity} entity The entity to delete.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.deleteEntity =
    function(entity, lastUpdate, success, failure) {
  goog.asserts.assert(entity instanceof pn.data.Entity);
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = this.getEntityJson_(entity, lastUpdate);
  this.ajax_('DeleteEntity', json, success, failure);
};


/**
 * @param {!Array.<!pn.data.Query>} queries The queries to update.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.getQueryUpdates =
    function(queries, lastUpdate, success, failure) {
  goog.asserts.assert(goog.isArray(queries) && queries.length > 0);
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = {
    'lastUpdate': lastUpdate,
    'queries': queries
  };
  this.ajax_('GetQueryUpdates', json, success, failure);
};


/**
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.getAllUpdates =
    function(lastUpdate, success, failure) {
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = { 'lastUpdate': lastUpdate };
  this.ajax_('GetAllUpdates', json, success, failure);
};


/**
 * @param {!Array.<pn.data.Query|string>} queries The queries to run on the
 *    server.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {!function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.query =
    function(queries, lastUpdate, success, failure) {
  goog.asserts.assert(goog.isArray(queries) && queries.length > 0);
  goog.asserts.assert(goog.isNumber(lastUpdate) && lastUpdate >= 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  var json = {
    'queries': pn.json.serialiseJson(queries),
    'lastUpdate': lastUpdate
  };
  this.ajax_('Query', json, success, failure);
};


/**
 * @private
 * @param {!pn.data.Entity} entity The entity to convert to a json data object.
 * @param {number} lastUpdate The last 'server' time the cache was updated.
 * @return {{type:string, entityJson:string}}
 */
pn.data.Server.prototype.getEntityJson_ = function(entity, lastUpdate) {
  goog.asserts.assert(entity instanceof pn.data.Entity);

  return {
    'lastUpdate': lastUpdate,
    'type': entity.type,
    'entityJson': pn.json.serialiseJson(entity)
  };
};


/**
 * @private
 * @param {string} action The name of the action on the server endpoint.
 * @param {!Object} data The data to send to the endpoint.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.ajax_ = function(action, data, success, failure) {
  goog.asserts.assert(goog.isString(action));
  goog.asserts.assert(goog.isObject(data));
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  this.dispatchEvent(new goog.events.Event(pn.data.Server.EventType.LOADING));

  var uri = this.controller_ + action,
      start = goog.now(),
      rid = uri + (this.requestCount_++),
      qd = goog.uri.utils.buildQueryDataFromMap(data),
      callback = goog.bind(function(e) {
        goog.asserts.assert(e.target instanceof goog.net.XhrIo);
        this.reply_(e.target, start, success, failure);
      }, this);

  this.manager_.send(rid, uri, 'POST', qd, null, null, callback);
};


/**
 * @private
 * @param {!goog.net.XhrIo} xhr The xhr request details.
 * @param {number} start The time the request began.
 * @param {!function(!pn.data.Server.Response):undefined} success The
 *    success callback.
 * @param {function(string):undefined} failure The failure callback.
 */
pn.data.Server.prototype.reply_ = function(xhr, start, success, failure) {
  goog.asserts.assert(xhr instanceof goog.net.XhrIo);
  goog.asserts.assert(goog.isNumber(start) && start > 0);
  goog.asserts.assert(goog.isFunction(success));
  goog.asserts.assert(goog.isFunction(failure));

  if (!xhr.isSuccess()) {
    failure('An unexpected error has occurred.');
  } else {
    var resp = xhr.getResponseText();
    if (goog.string.startsWith(resp, 'ERROR:')) {
      failure(resp.split(':')[1]);
    } else {
      var raw = /** @type {pn.data.Server.RawResponse} */ (
          pn.json.parseJson(resp));
      var response = new pn.data.Server.Response(raw);
      success(response);
    }
  }

  this.log_.info('ajax uri: ' + xhr.getLastUri() + ' completed. Took: ' +
      (goog.now() - start) + 'ms.');

  this.dispatchEvent(new goog.events.Event(pn.data.Server.EventType.LOADED));
};


/**
 * @typedef {{
 *    Type:string,
 *    ID:number,
 *    EntityType:string,
 *    Entity:Object
 *  }}
 */
pn.data.Server.RawUpdate;


/**
 * @typedef {{
 *    lastUpdate:number,
 *    Updates:!Array.<pn.data.Server.RawUpdate>,
 *    ResponseEntityType:string,
 *    ResponseEntity:Object,
 *    AjaxResponse: Object
 *  }}
 */
pn.data.Server.RawResponse;



/**
 * @constructor
 * @param {pn.data.Server.RawResponse} raw The raw response json object
 *    from the server.
 */
pn.data.Server.Response = function(raw) {
  goog.asserts.assert(goog.isObject(raw));

  /** @type {!Array.<pn.data.Server.Update>} */
  this.updates = goog.array.map(raw['Updates'],
      function(u) { return new pn.data.Server.Update(u); }, this);

  /** @type {pn.data.Entity} */
  this.responseEntity = raw['ResponseEntityType'] ?
      pn.data.TypeRegister.parseEntity(raw['ResponseEntityType'],
          /** @type {!Object} */ (pn.json.parseJson(raw['ResponseEntity']))) :
      null;

  /** @type {Object} */
  this.ajaxData = raw['AjaxResponse'];

  goog.asserts.assert(goog.isArray(this.updates));
  goog.asserts.assert(!goog.isDefAndNotNull(this.responseEntity) ||
      this.responseEntity instanceof pn.data.Entity);
  goog.asserts.assert(!goog.isDef(this.ajaxData) ||
      goog.isObject(this.ajaxData));
};



/**
 * @constructor
 * @param {pn.data.Server.RawUpdate} raw The raw response json object from
 *    the server.
 */
pn.data.Server.Update = function(raw) {
  goog.asserts.assert(goog.isObject(raw));

  /** @type {string} */
  this.queryId = raw['QueryId'];

  /** @type {number} */
  this.queryLastUpdate = raw['QueryLastUpdate'];

  /** @type {string} */
  this.type = raw['UpdateType'];

  /** @type {number} */
  this.id = raw['EntityId'];

  /** @type {string} */
  this.entityType = raw['EntityType'];

  /** @type {pn.data.Entity} */
  this.entity = raw['Entity'] ?
      pn.data.TypeRegister.parseEntity(raw['EntityType'], raw['Entity']) :
      null;

  goog.asserts.assert(goog.isNumber(this.id));
  goog.asserts.assert(goog.isString(this.entityType));
  goog.asserts.assert(this.type === 'create' ||
      this.type === 'update' || this.type === 'delete');
  goog.asserts.assert(this.type !== 'delete' || this.entity === null);
  goog.asserts.assert(this.type === 'delete' ||
      this.entity instanceof pn.data.Entity);
};


/** @enum {string} */
pn.data.Server.EventType = {
  LOADING: 'server-loading',
  LOADED: 'server-loaded'
};