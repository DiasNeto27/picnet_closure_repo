﻿;
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.events.EventHandler');
goog.require('goog.json');
goog.require('goog.net.IframeIo');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.EventType');
goog.require('goog.ui.Option');
goog.require('goog.ui.Select');

goog.provide('pn.ui.grid.ExportCommand');



/**
 * @constructor
 * @extends {goog.ui.Component}
 */
pn.ui.grid.ExportCommand = function() {
  goog.ui.Component.call(this);

  /**
   * @type {pn.ui.grid.Grid.EventType}
   */
  this.eventType = pn.ui.grid.Grid.EventType.EXPORT_DATA;

  /**
   * @private
   * @type {Element}
   */
  this.select_ = null;

  /**
   * @private
   * @type {!goog.events.EventHandler}
   */
  this.eh_ = new goog.events.EventHandler(this);
};
goog.inherits(pn.ui.grid.ExportCommand, goog.ui.Component);


/** @inheritDoc */
pn.ui.grid.ExportCommand.prototype.createDom = function() {
  this.decorateInternal(this.dom_.createElement('div'));
};


/** @inheritDoc */
pn.ui.grid.ExportCommand.prototype.decorateInternal = function(element) {
  this.setElementInternal(element);
  this.select_ = goog.dom.createDom('select', 'export-select',
      goog.dom.createDom('option', {'value': '0'}, 'Export Data...'),
      goog.dom.createDom('option', {'value': 'csv'}, 'CSV'),
      goog.dom.createDom('option', {'value': 'txt'}, 'TXT'),
      goog.dom.createDom('option', {'value': 'xls'}, 'Excel'),
      goog.dom.createDom('option', {'value': 'pdf'}, 'PDF')
      );
  goog.dom.appendChild(element, this.select_);
};


/** @inheritDoc */
pn.ui.grid.ExportCommand.prototype.enterDocument = function() {
  this.eh_.listen(this.select_, goog.events.EventType.CHANGE, function() {
    var exportFormat = this.select_.value;
    if (!exportFormat) return;
    this.select_.selectedIndex = 0;
    var e = new goog.events.Event(this.eventType, this);
    e.exportFormat = exportFormat;
    this.dispatchEvent(e);
  });
};


/** @inheritDoc */
pn.ui.grid.ExportCommand.prototype.exitDocument = function() {
  this.eh_.removeAll();
};


/** @inheritDoc */
pn.ui.grid.ExportCommand.prototype.disposeInternal = function() {
  goog.dispose(this.select_);
  goog.dispose(this.eh_);

  delete this.select_;
  delete this.eh_;
};
