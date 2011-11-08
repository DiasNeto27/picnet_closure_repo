﻿;
goog.provide('pn.ui.edit.CommandsComponent');

goog.require('goog.dom');
goog.require('goog.events.Event');
goog.require('goog.events.EventHandler');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.EventType');
goog.require('pn.ui.edit.Command');
goog.require('pn.ui.edit.ComplexRenderer');
goog.require('pn.ui.edit.Config');
goog.require('pn.ui.edit.Field');
goog.require('pn.ui.edit.FieldBuilder');
goog.require('pn.ui.edit.FieldValidator');
goog.require('pn.ui.grid.Column');
goog.require('pn.ui.grid.Config');
goog.require('pn.ui.grid.Grid');



/**
 * @constructor
 * @extends {goog.ui.Component}
 * @param {!Array.<pn.ui.edit.Command>} commands The commands to show in the
 *    edit page.
 */
pn.ui.edit.CommandsComponent = function(commands) {
  goog.asserts.assert(commands);

  goog.ui.Component.call(this);

  /**
   * @protected
   * @type {!goog.events.EventHandler}
   */
  this.eh = new goog.events.EventHandler(this);

  /**
   * @private
   * @type {!Array.<pn.ui.edit.Command>}
   */
  this.commands_ = commands;

  /**
   * @private
   * @type {!Array.<goog.ui.Button>}
   */
  this.buttons_ = [];
};
goog.inherits(pn.ui.edit.CommandsComponent, goog.ui.Component);


/** @inheritDoc */
pn.ui.edit.CommandsComponent.prototype.createDom = function() {
  this.decorateInternal(this.dom_.createElement('div'));
};


/**
 * @protected
 * @return {boolean} If this form is valid.
 */
pn.ui.edit.CommandsComponent.prototype.isValidForm = goog.abstractMethod;


/**
 * @protected
 * @return {Object} The current form data (Read from input controls).
 */
pn.ui.edit.CommandsComponent.prototype.getCurrentFormData = goog.abstractMethod;


/** @inheritDoc */
pn.ui.edit.CommandsComponent.prototype.decorateInternal = function(element) {
  this.setElementInternal(element);
  if (!this.commands_.length) return;

  var div = goog.dom.createDom('div', {'class': 'commands-container'});
  goog.dom.appendChild(element, div);

  this.decorateCommands_(div);
};


/**
 * @private
 * @param {!Element} parent The parent element to attach the controls to.
 */
pn.ui.edit.CommandsComponent.prototype.decorateCommands_ = function(parent) {
  goog.array.forEach(this.commands_, function(c) {
    var button = new goog.ui.Button(c.name);
    button.render(parent);
    this.buttons_.push(button);
  }, this);
};


/** @inheritDoc */
pn.ui.edit.CommandsComponent.prototype.enterDocument = function() {
  pn.ui.edit.CommandsComponent.superClass_.enterDocument.call(this);

  goog.array.forEach(this.commands_, this.enterDocumentOnCommand_, this);
};


/**
 * @private
 * @param {pn.ui.edit.Command} command The command to attach events to.
 * @param {number} idx The index of the specified command.
 */
pn.ui.edit.CommandsComponent.prototype.enterDocumentOnCommand_ =
    function(command, idx) {
  var button = this.buttons_[idx];
  this.eh.listen(button, goog.ui.Component.EventType.ACTION, function() {
    if (command.validate && !this.isValidForm()) { return; }
    this.fireCommandEvent(command.eventType, this.getCurrentFormData());
  });
};


/**
 * @protected
 * @param {string} eventType The event type to fire.
 * @param {Object} data The current form data.
 */
pn.ui.edit.CommandsComponent.prototype.fireCommandEvent = goog.abstractMethod;


/** @inheritDoc */
pn.ui.edit.CommandsComponent.prototype.exitDocument = function() {
  pn.ui.edit.CommandsComponent.superClass_.exitDocument.call(this);

  this.eh.removeAll();
};


/** @inheritDoc */
pn.ui.edit.CommandsComponent.prototype.disposeInternal = function() {
  pn.ui.edit.CommandsComponent.superClass_.disposeInternal.call(this);

  goog.dispose(this.eh);
  goog.array.forEach(this.buttons_, goog.dispose);
  goog.object.forEach(this.commands_, goog.dispose);

  delete this.eh;
};