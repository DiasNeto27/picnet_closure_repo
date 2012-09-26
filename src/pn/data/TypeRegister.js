﻿;
goog.provide('pn.data.TypeRegister');

goog.require('goog.asserts');


/**
 * @private
 * @type {!Object.<pn.data.Entity.EntityType>}
 */
pn.data.TypeRegister.types_ = {};


/**
 * @param {string} name The type name of the entity.
 * @param {pn.data.Entity.EntityType} ctor The entity type ctor.
 */
pn.data.TypeRegister.register = function(name, ctor) {
  pn.ass(goog.isString(name));
  pn.ass(goog.isFunction(ctor));

  pn.data.TypeRegister.types_[name] = ctor;
};


/**
 * @param {string} name The type name of the entity.
 * @return {pn.data.Entity.EntityType} The registered ctor for the the
 *    specified entity type.
 */
pn.data.TypeRegister.fromName = function(name) {
  pn.ass(goog.isString(name));

  var ctor = pn.data.TypeRegister.types_[name];
  pn.ass(ctor, 'Could not find entity factory of type: ' + name);

  return ctor;
};


/**
 * @param {string} type The type of the entity being saved/delete/clone.
 * @param {!Object} raw The raw entity data to send to the server.
 * @return {!pn.data.Entity} The created entity with additional private fields.
 */
pn.data.TypeRegister.create = function(type, raw) {
  var ctor = pn.data.TypeRegister.fromName(type);
  var entity = new ctor(raw);
  for (var p in raw) {
    if (goog.string.startsWith(p, '_')) {
      entity[p] = raw[p];
    }
  }
  return entity;
};


/**
 * @param {string} type The type of the entities to attempt to parse.
 * @param {!Array} data The data to attempt to parse.
 * @return {!Array.<pn.data.Entity>} The parsed entity or the original data.
 */
pn.data.TypeRegister.parseEntities = function(type, data) {
  pn.ass(goog.isString(type));
  pn.ass(goog.isObject(data));

  var action = goog.partial(pn.data.TypeRegister.parseEntity, type);
  return data.pnmap(action);
};


/**
 * @param {string} type The type of the entity to attempt to parse.
 * @param {Object} data The data to attempt to parse.
 * @return {pn.data.Entity} The parsed entity or the original data.
 */
pn.data.TypeRegister.parseEntity = function(type, data) {
  pn.ass(goog.isString(type));
  pn.ass(goog.isObject(data));

  var ctor = pn.data.TypeRegister.fromName(type);
  return new ctor(data);
};


/**
 * @param {string} type The entity type to enfer the property type from.
 * @param {string} property The entity property to convert to a type name if
 *    possible.
 * @return {pn.data.FieldSchema} The field schema of the specified field.
 */
pn.data.TypeRegister.getFieldSchema = function(type, property) {
  pn.ass(goog.isString(type), '"type" not specified');
  pn.ass(goog.isString(property), '"property" not specified');

  return pn.data.TypeRegister.fromName(type).prototype.getFieldSchema(property);
};
