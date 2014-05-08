﻿;
goog.provide('pn.ui.FieldCtx');

goog.require('goog.date.Date');
goog.require('pn.ui.BaseFieldSpec');
goog.require('pn.ui.edit.FieldRenderers');
goog.require('pn.ui.grid.ColumnRenderers');



/**
 * @constructor
 * @extends {goog.Disposable}
 * @param {pn.ui.BaseFieldSpec} spec The field specifications.
 * @param {!Object} entity The current entity being rendererd.
 * @param {!Object.<!Array.<!Object>>} cache The current cache.
 */
pn.ui.FieldCtx = function(spec, entity, cache) {
  goog.asserts.assert(spec);
  goog.asserts.assert(entity);
  goog.asserts.assert(cache);

  goog.Disposable.call(this);

  /** @type {!pn.ui.BaseFieldSpec} */
  this.spec = spec;

  /** @type {Object} */
  this.entity = entity;

  /** @type {!Object.<!Array.<!Object>>} */
  this.cache = cache;

  /** @type {!string} */
  this.id = spec.id;

  /** @type {!pn.ui.UiSpec} */
  this.entitySpec = spec.entitySpec;

  /** @type {pn.app.schema.FieldSchema} */
  this.schema = pn.app.ctx.schema.getFieldSchema(spec);

  /** @type {(Element|goog.ui.Component|Text)} */
  this.component = null;

  /** @type {Element} */
  this.parentComponent = null;

  /**
   * @private
   * @type {goog.debug.Logger}
   */
  this.log_ = pn.log.getLogger('pn.ui.FieldCtx');

  // TODO: This is not nice here.
  if (this.spec instanceof pn.ui.edit.FieldSpec &&
      this.getFieldRenderer() === pn.ui.edit.FieldRenderers.dateRenderer) {
    this.normaliseDateField_();
  }
};
goog.inherits(pn.ui.FieldCtx, goog.Disposable);


/**
 * This is required so that fields with date only (no time) renderers don't
 *    throw 'dirty' checks when nothing has changed (just time is lost)
 * @private
 */
pn.ui.FieldCtx.prototype.normaliseDateField_ = function() {
  var date = this.entity[this.id];
  if (!goog.isNumber(date)) return;
  var dt = new goog.date.Date();
  dt.setTime(/** @type {number} */ (date));
  var trimmed = new goog.date.Date(dt.getYear(), dt.getMonth(), dt.getDate());
  this.entity[this.id] = trimmed.getTime();
};


/** @return {boolean} Wether this field is editable. */
pn.ui.FieldCtx.prototype.isEditable = function() {
  goog.asserts.assert(this.entity);

  return !this.spec.readonly && !this.spec.tableType &&
      (this.spec.showOnAdd || !pn.data.EntityUtils.isNew(this.entity));
};


/** @return {boolean} Wether this field is required. */
pn.ui.FieldCtx.prototype.isRequired = function() {
  if (this.spec.readonly) return false;
  return (this.spec.validator && this.spec.validator.required) ||
      (this.schema != null && !this.schema.allowNull);
};


/**
 * @param {Object=} opt_target The optional 'entity' target to inject values
 *    into if required.
 * @return {*} The current control value of this field.
 */
pn.ui.FieldCtx.prototype.getControlValue = function(opt_target) {
  return pn.ui.edit.FieldBuilder.getFieldValue(this.component, opt_target);
};


/** @return {*} The value of  this field. */
pn.ui.FieldCtx.prototype.getEntityValue = function() {
  var prop = this.spec.dataProperty;
  var v = this.entity[prop];
  if (goog.isDef(v)) return v;

  if (pn.data.EntityUtils.isNew(this.entity)) {
    if (goog.isDefAndNotNull(this.spec.defaultValue)) {
      return this.getDefaultFieldValue_();
    }
    return v;
  }

  if (goog.string.endsWith(prop, 'Entities') && goog.isArray(v)) {
    // Controls always return sorted IDs so here we ensure we never throw a
    // dirty error if for somereason the original value is not sorted.
    v.sort();
  }
  return v;
};


/** @return {*} The display value of this field. */
pn.ui.FieldCtx.prototype.getDisplayValue = function() {
  return pn.data.EntityUtils.getEntityDisplayValue(
      this.cache,
      this.spec.displayPath,
      this.entity,
      this.spec.tableParentField,
      this.spec.entityType);
};


/**
 * @return {*} The compareable value of this column, suitable for sorting, etc.
 */
pn.ui.FieldCtx.prototype.getCompareableValue = function() {
  goog.asserts.assert(this.spec instanceof pn.ui.grid.ColumnSpec);

  var renderer = this.getColumnRenderer();
  var useRealValue =
      !renderer ||
      renderer === pn.ui.grid.ColumnRenderers.dateRenderer ||
      renderer === pn.ui.grid.ColumnRenderers.dateTimeRenderer ||
      renderer === pn.ui.grid.ColumnRenderers.centsRenderer;
  return useRealValue ? this.getEntityValue() : renderer(this);
};


/**
 * @return {boolean} Wether this field is currently dirty (i.e. The control is
 *    different than the entity value).
 */
pn.ui.FieldCtx.prototype.isDirty = function() {
  var orig = this.getEntityValue();
  var curr = this.getControlValue();

  // Handle tricky falsies
  var isFalseEquivalent = function(val) {
    return !val || val === '0' || val === 'false' || val === '{}';
  };
  if (isFalseEquivalent(curr) && isFalseEquivalent(orig)) { return false; }

  // goog.string.canonicalizeNewlines required for IE7 which handles
  // newlines differently adding a keycode 13,10 rather than just 10
  curr = curr ? goog.string.canonicalizeNewlines(curr.toString()) : '';
  orig = orig ? goog.string.canonicalizeNewlines(orig.toString()) : '';

  if (curr !== orig) {
    this.log_.info('Dirty ' + this.id + ' 1[' + orig + '] 2[' + curr + ']');
  }
  return curr !== orig;
};


/**
 * @return {!Array.<string>} An error list of all validation errors (empty if
 *    no errors found).
 */
pn.ui.FieldCtx.prototype.validate = function() {
  var errs = pn.ui.edit.FieldValidator.validateFieldValue(this);
  if (errs.length) {
    var val = this.getControlValue();
    this.log_.info('Field: ' + this.id + ' val: ' + val + ' error: ' + errs);
  }
  return errs;
};


/**
 * @return {null|function(!pn.ui.FieldCtx):string} The specified
 *    column renderer or an implied renderer from the given column schema type.
 */
pn.ui.FieldCtx.prototype.getColumnRenderer = function() {
  goog.asserts.assert(this.spec instanceof pn.ui.grid.ColumnSpec);

  if (goog.isDef(this.spec.renderer)) return this.spec.renderer;
  if (!this.schema) return null;
  return pn.app.ctx.cfg.defaultColumnRenderers[this.schema.type] || null;
};


/**
 * @return {null|pn.ui.edit.ComplexRenderer|
 *    function(!pn.ui.FieldCtx):!(goog.ui.Component|Text|Element)} The
 *    specified field renderer or an implied renderer from the given column
 *    schema type.
 */
pn.ui.FieldCtx.prototype.getFieldRenderer = function() {
  goog.asserts.assert(this.spec instanceof pn.ui.edit.FieldSpec);

  if (this.spec.renderer) return this.spec.renderer;
  if (!this.schema) return null;
  return pn.app.ctx.cfg.defaultFieldRenderers[this.schema.type] || null;
};


/**
 * @private
 * @return {*} The default value of  this field.
 */
pn.ui.FieldCtx.prototype.getDefaultFieldValue_ = function() {
  goog.asserts.assert(goog.isDefAndNotNull(this.spec.defaultValue));
  var val = this.spec.defaultValue;
  if (pn.data.EntityUtils.isParentProperty(this.spec.dataProperty)) {
    var type = pn.data.EntityUtils.getTypeProperty(this.spec.dataProperty);
    var list = this.cache[type];
    val = goog.array.find(list, function(e) {
      return e[type + 'Name'] === this.spec.defaultValue;
    }, this)['ID'];
  }
  return val;
};


/** @inheritDoc */
pn.ui.FieldCtx.prototype.disposeInternal = function() {
  pn.ui.FieldCtx.superClass_.disposeInternal.call(this);

  goog.dispose(this.log_);
  goog.dispose(this.component);
  goog.dispose(this.parentComponent);
  goog.dispose(this.spec);

  delete this.log_;
  delete this.spec;
  delete this.entity;
  delete this.cache;
  delete this.entitySpec;
  delete this.schema;
  delete this.component;
  delete this.parentComponent;
};
