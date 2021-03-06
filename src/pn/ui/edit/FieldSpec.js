﻿;
goog.provide('pn.ui.edit.FieldSpec');
goog.provide('pn.ui.edit.FieldSpec.Renderer');

goog.require('pn.ui.BaseFieldSpec');
goog.require('pn.ui.IDefaultRenderer');
goog.require('pn.ui.edit.ComplexRenderer');



/**
 * The Field specification defines how a field should be captioned and how
 *    the input element (if any) should be rendered and handled.
 *
 * BaseField types (Field / Column) should be constructed using the
 *    convenience methods in UiSpec (UiSpec.prototype.createField).
 *
 * @constructor
 * @extends {pn.ui.BaseFieldSpec}
 * @param {string} id The id of this column.
 * @param {!Object} props The properties to add this field.  After adding
 *    we will also apply default values to any attribute that was not
 *    explicitally set.
 * @param {!pn.ui.UiSpec} entitySpec The specifications (pn.ui.UiSpec) of
 *    the entity being displayed.
 * @param {!pn.ui.IDefaultRenderer} defrender The builder for the default
 *    renderer.
 */
pn.ui.edit.FieldSpec = function(id, props, entitySpec, defrender) {
  pn.assStr(id);
  pn.assObj(props);
  pn.assInst(entitySpec, pn.ui.UiSpec);
  pn.ass(!!defrender && defrender.getDefaultRenderer);

  pn.ui.BaseFieldSpec.call(this, id, entitySpec);

  /**
   * @private
   * @type {!pn.ui.IDefaultRenderer}
   */
  this.defrender_ = defrender;

  /**
   * The renderer to use to render this field value.  This can either be of
   *    type pn.ui.edit.ComplexRenderer or simply a function that takes 3
   *    parameters and returns either a dom Element/Text a goog.ui.Component.
   *    The 3 parameters are the the value to display, the entity being
   *    displayed and the parent Dom Element.
   *
   * @type {undefined|pn.ui.edit.FieldSpec.Renderer}
   */
  this.renderer = undefined;

  /**
   * The custom validator for this field.  The validator can either be an
   *    instance of pn.ui.edit.ValidateInfo or a function that takes 2
   *    parameters, the Field specs (this class) and the current value and
   *    returns a string which represents the validation error (falsy
   *    represents no error).
   *
   * @type {pn.ui.edit.FieldSpec.Validator}
   */
  this.validator = null;

  /**
   * If the pn.data.EntityUtils.isNew(entity) then any showOnAdd=false
   *    fields will not be shown.
   *
   * @type {boolean}
   */
  this.showOnAdd = true;

  /**
   * This field will not be checked for dirty states if this is true.
   *
   * @type {boolean}
   */
  this.ignoreDirty = false;

  /**
   * Wether this field is readonly.  If specifying a renderer this value is
   *    ignored.
   *
   * @type {boolean}
   */
  this.readonly = false;

  /**
   * Wether this field is displayed when readonly. This fieldSpec is readonly.
   *
   * @type {boolean}
   */
  this.showOnReadOnly = true;

  /**
   * Wether this text field is mirrored in a div intended solely for printing.
   *    To support this functionality the css file must include the following
   *    two classes:
   *      .print-only  Which is display:none when in media=screen and shown
   *        in media=print.
   *      .hide-on-print Which is hidden when media=print
   *
   * @type {boolean}
   */
  this.createPrintDiv = false;

  /**
   * The default value to apply to the specified field.  This is only used
   *    when creating a new entity.
   *
   * @type {*}
   */
  this.defaultValue = undefined;

  /**
   * When displaying a table in this Field this field denotes the type of
   *    entity being displayed in the table.  If this is not specified we try
   *    to intelligently guess this by using the id of thie field.  If the
   *    ID ends with 'Entities' then we use the prefix of this id.  For example:
   *    if the id is: ChildrenEntities then the tableType will become
   *    'Children'.
   *
   * @type {string|undefined}
   */
  this.tableType = undefined;

  /**
   * When displaying a table in this field this points to the UiSpec id that
   *    will be used when rendering this table. If this is not specified then
   *    it will be the same as the tableType.
   *
   * @type {string|undefined}
   */
  this.tableSpec = undefined;

  /**
   * When displaying a table we only display the children entities that are
   *    related to the current entity being displayed in the parent page.  This
   *    field is the field that marks this relationship.  For instance:
   *
   * tabeType: 'Children',
   * tableParentField: 'ParentID'
   *
   * This setup will display a table of Children entities where their 'ParentID'
   *    property is equal to the 'ID' property of the current page entity. Note:
   *    this property is intelligently inferred if not specified from the type
   *    name of the entity being displayed (parent to this field).
   *
   * @type {string}
   */
  this.tableParentField = '';

  /**
   * Any additional properties required by the validator or renderer.  This
   *    can be an object with any property values and is intended to be used
   *    with custom renderers/validators to enhance existing funcitonality.
   *    NOTE: It is better to set and access these properties using
   *    doctionary['access'] so this can work with server generated properties.
   *
   * @type {!Object}
   */
  this.additionalProperties = {};

  this.extend(props);
};
goog.inherits(pn.ui.edit.FieldSpec, pn.ui.BaseFieldSpec);


/** @override */
pn.ui.edit.FieldSpec.prototype.extend = function(props) {
  pn.ui.edit.FieldSpec.superClass_.extend.call(this, props);

  var firstStep = this.id.split('.')[0];
  if (firstStep.pnendsWith('Entities')) {
    if (!goog.isDef(this.tableType) && !this.renderer) {
      this.tableType = pn.data.EntityUtils.getTypeProperty(
          this.entitySpec.type, firstStep);
    }
    if (!goog.isDef(this.tableSpec) && !this.renderer) {
      this.tableSpec = this.tableType;
    }
  }

  if (this.tableType && !this.tableParentField) {
    this.tableParentField = this.entitySpec + 'ID';
  }

  if (!this.renderer) {
    this.renderer = this.defrender_.getDefaultRenderer(this);
    pn.ass(this.renderer);
  }
};


/**
 * @typedef {!pn.ui.edit.ComplexRenderer|
 *     function(!pn.ui.edit.FieldCtx,!Element,!pn.data.Entity):
 *       !(Element|Text|goog.ui.Component)}
 */
pn.ui.edit.FieldSpec.Renderer;


/**
 * @typedef
 *    {null|pn.ui.edit.ValidateInfo|function(pn.ui.edit.FieldCtx,
 *        !(Element|Text|goog.ui.Component)):string}
 */
pn.ui.edit.FieldSpec.Validator;
