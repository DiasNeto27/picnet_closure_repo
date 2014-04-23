﻿;
goog.provide('pn.ui.grid.Grid');
goog.provide('pn.ui.grid.Grid.EventType');

goog.require('goog.dom');
goog.require('goog.events.Event');
goog.require('goog.events.EventHandler');
goog.require('goog.i18n.NumberFormat');
goog.require('goog.net.cookies');
goog.require('goog.positioning.AbsolutePosition');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.EventType');
goog.require('goog.ui.Tooltip');
goog.require('pn.ui.grid.Column');
goog.require('pn.ui.grid.Config');
goog.require('pn.ui.grid.QuickFilterHelpers');



/**
 * The pn.ui.grid.Grid is built atop SlickGrid
 * (https://github.com/mleibman/SlickGrid/).  See SlickGrid documentation for
 * full detauils.
 *
 * @constructor
 * @extends {goog.ui.Component}
 * @param {!Array} list The entities to display.
 * @param {!Array.<pn.ui.grid.Column>} cols The columns to display.
 * @param {!Array.<goog.ui.Component>} commands The commands supported.
 * @param {!pn.ui.grid.Config} cfg The grid configuration.
 * @param {!Object.<Array>} cache The data cache to use for related entities.
 */
pn.ui.grid.Grid = function(list, cols, commands, cfg, cache) {
  goog.asserts.assert(list);
  goog.asserts.assert(cols && cols.length);

  var uniqueColIds = goog.array.map(cols, function(c) { return c.id; });
  goog.array.removeDuplicates(uniqueColIds);
  goog.asserts.assert(cols.length === uniqueColIds.length,
      'All column IDs should be unique. Grid type: ' + cfg.type);
  goog.asserts.assert(cfg);
  goog.asserts.assert(cache);
  goog.ui.Component.call(this);

  /**
   * @private
   * @const
   * @type {string}
   */
  this.hash_ = cfg.hashPrefix + /** @type {string} */ (goog.array.reduce(
      uniqueColIds, function(acc, f) { return acc + f; }, ''));

  /**
   * @private
   * @type {goog.debug.Logger}
   */
  this.log_ = pn.LogUtils.getLogger('pn.ui.grid.Grid');

  /**
   * @private
   * @type {!Array}
   */
  this.list_ = list;


  /**
   * @private
   * @type {!Array.<pn.ui.grid.Column>}
   */
  this.cols_ = this.getColumnsWithInitialState_(cols);

  /**
   * @private
   * @type {!Array.<pn.ui.grid.Column>}
   */
  this.totalColumns_ =
      goog.array.filter(this.cols_, function(c) { return c.total; });

  /**
   * @private
   * @type {goog.i18n.NumberFormat}
   */
  this.totalsFormatter_ = new goog.i18n.NumberFormat('#,##0.0#;');

  /**
   * @private
   * @type {!pn.ui.grid.Config}
   */
  this.cfg_ = cfg;

  /**
   * @private
   * @type {!Object.<Array>}
   */
  this.cache_ = cache;

  /**
   * @private
   * @type {!Array.<goog.ui.Component>}
   */
  this.commands_ = commands;

  /**
   * @private
   * @type {Slick.Grid}
   */
  this.slick_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.noData_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.gridContainer_ = null;

  /**
   * @private
   * @type {Slick.Data.DataView}
   */
  this.dataView_ = null;

  /**
   * @private
   * @type {Function}
   */
  this.selectionHandler_ = null;

  /**
   * @private
   * @type {!goog.events.EventHandler}
   */
  this.eh_ = new goog.events.EventHandler(this);

  /**
   * @private
   * @type {null|function(Object):boolean}
   */
  this.currentFilter_ = null;

  /**
   * @private
   * @type {Object.<string>}
   */
  this.quickFilters_ = {};

  /**
   * @private
   * @type {Object.<Element>}
   */
  this.quickFilterControls_ = {};

  /**
   * @private
   * @type {Object}
   */
  this.sort_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.totalsLegend_ = null;

  /**
   * @private
   * @type {goog.ui.Tooltip}
   */
  this.tooltip_ = null;

};
goog.inherits(pn.ui.grid.Grid, goog.ui.Component);


/**
 * @param {function(Object):boolean} filter The filter function to apply.
 */
pn.ui.grid.Grid.prototype.filter = function(filter) {
  this.log_.info('Filtering grid');
  this.currentFilter_ = filter;
  this.dataView_.refresh();
  this.slick_.render();
};


/**
 * @private
 * @param {!Object} item The row item to pass to the currentFilter_.
 * @return {boolean} Whether the specified item satisfies the currentFilter.
 */
pn.ui.grid.Grid.prototype.filterImpl_ = function(item) {
  if (this.cfg_.enableQuickFilters && !this.quickFilter_(item)) return false;
  return !this.currentFilter_ || this.currentFilter_(item);
};


/** @inheritDoc */
pn.ui.grid.Grid.prototype.createDom = function() {
  this.decorateInternal(this.dom_.createElement('div'));
};


/** @inheritDoc */
pn.ui.grid.Grid.prototype.decorateInternal = function(element) {
  goog.asserts.assert(this.cfg_.width);

  this.setElementInternal(element);
  if (!this.cfg_.readonly) {
    goog.array.forEach(this.commands_, function(c) {
      c.decorate(element);
    }, this);
  }
  var height = 80 + Math.min(550, this.list_.length * 25) + 'px;';

  var parent = goog.dom.createDom('div', 'grid-parent ' + this.cfg_.type,
      this.noData_ = goog.dom.createDom('div', {
        'class': 'grid-no-data',
        'style': 'display:none'
      }, 'No matches found.'),
      this.gridContainer_ = goog.dom.createDom('div', {
        'class': 'grid-container',
        'style': 'width:' + this.cfg_.width + 'px;height:' + height
      }));
  goog.dom.appendChild(element, parent);

  this.tooltip_ = new goog.ui.Tooltip();

  this.dataView_ = new Slick.Data.DataView();
  this.slick_ = new Slick.Grid(this.gridContainer_, this.dataView_,
      goog.array.map(this.cols_, function(c) {
        if (!this.cfg_.sortable) c.sortable = false;
        if (!c.renderer && c.source) {
          c.isParentFormatter = true;
          c.renderer = goog.bind(this.parentColumnFormatter_, this);
        }
        return c.toSlick(c.renderer);
      }, this), this.cfg_.toSlick());
  if (this.totalColumns_.length) {
    this.totalsLegend_ = goog.dom.createDom('div', 'totals-legend');
    goog.dom.appendChild(element, this.totalsLegend_);
  }
  goog.style.showElement(this.noData_, this.dataView_.getLength() === 0);
  goog.style.showElement(this.gridContainer_, true);
};


/**
 * @private
 * @param {!Array.<pn.ui.grid.Column>} cols The unsorted columns.
 * @return {!Array.<pn.ui.grid.Column>} The sorted columns with savewd widths.
 */
pn.ui.grid.Grid.prototype.getColumnsWithInitialState_ = function(cols) {
  var state = goog.net.cookies.get(this.hash_);
  if (!state) return cols;
  var data = goog.json.unsafeParse(state);
  var ids = data['ids'];
  var widths = data['widths'];
  var ordered = [];
  goog.array.forEach(ids, function(id, idx) {
    var colidx = goog.array.findIndex(cols, function(c) {
      return c.id === id;
    });
    var col = cols[colidx];
    delete cols[colidx];
    col.width = widths[idx];
    ordered.push(col);
  });
  // Add remaining columns (if any)
  goog.array.forEach(cols, ordered.push);
  return ordered;
};


/**
 * @return {Array.<Array.<string>>} The data of the grid. This is used when
 *    exporting the grid contents.
 */
pn.ui.grid.Grid.prototype.getGridData = function() {
  var headers = goog.array.map(this.cols_,
      function(c) { return c.name; }, this);
  var gridData = [headers];
  for (var row = 0, len = this.dataView_.getLength(); row < len; row++) {
    var rowData = this.dataView_.getItem(row);
    var rowTxt = [];
    for (var col = 0, lencol = this.cols_.length; col < lencol; col++) {
      var cc = this.cols_[col];
      var dat = rowData[cc.dataColumn];
      var txt = cc.renderer ? cc.renderer(row, col, dat, cc, rowData) : dat;
      rowTxt.push(txt);
    }
    gridData.push(rowTxt);
  }
  return gridData;
};


/**
 * @private
 * @param {number} row The row index.
 * @param {number} cell The cell index.
 * @param {Object} value The raw cell value.
 * @param {pn.ui.grid.Column} col The Slick column config object.
 * @param {Object} dataContext entity data being displayed in this row.
 * @return {string} The html to render for this field.
 */
pn.ui.grid.Grid.prototype.parentColumnFormatter_ =
    function(row, cell, value, col, dataContext) {
  value = dataContext[col.dataColumn];
  if (!value) return '';
  return this.getCachedEntityName_(col, value);
};


/**
 * @private
 * @param {pn.ui.grid.Column} col The Slick column config object.
 * @param {number} id The id of the entitiy in the list.
 * @return {string} The entities name.
 */
pn.ui.grid.Grid.prototype.getCachedEntityName_ = function(col, id) {
  var steps = col.source.split('.');
  var entity = this.getTargetEntity_(goog.array.clone(steps), id);
  if (!entity) return '';

  var name = steps.length > 1 ? steps[steps.length - 1] : (steps[0] + 'Name');
  return entity[name];
};


/**
 * @private
 * @param {!Array.<string>} steps The steps (path) to the entity.
 * @param {number} id The id of the entitiy in the list.
 * @return {Object} The matched entity.
 */
pn.ui.grid.Grid.prototype.getTargetEntity_ = function(steps, id) {
  if (id <= 0) return null;
  var type = steps[0];
  goog.asserts.assert(this.cache_[type], 'Type: ' + type +
      ' not found in cache');
  var entity = /** @type {Object} */
      (goog.array.find(this.cache_[type],
      function(e) { return e['ID'] === id; }, this));
  if (steps.length > 2) {
    var id2 = entity[steps[1] + 'ID'];
    steps.shift();
    return this.getTargetEntity_(steps, id2);
  }
  return entity;
};


/** @inheritDoc */
pn.ui.grid.Grid.prototype.enterDocument = function() {
  pn.ui.grid.Grid.superClass_.enterDocument.call(this);

  // Selecting
  if (!this.cfg_.readonly) {
    this.slick_.setSelectionModel(new Slick.RowSelectionModel());
    this.selectionHandler_ = goog.bind(this.handleSelection_, this);
    this.slick_.onSelectedRowsChanged.subscribe(this.selectionHandler_);
    goog.array.forEach(this.commands_, function(c) {
      this.eh_.listen(c, c.eventType, function(e) {
        if (e.type === pn.ui.grid.Grid.EventType.CLEAR_FILTERS) {
          this.clearFilters_();
        } else {
          this.dispatchEvent(e);
        }
      });
    }, this);
  }
  // Sorting
  if (this.cfg_.sortable) {
    this.slick_.onSort.subscribe(goog.bind(function(e, args) {
      this.sortBy_(args['sortCol']['id'], args['sortAsc']);
      this.saveGridState_();
    }, this));
  }
  this.dataView_.onRowsChanged.subscribe(goog.bind(function(e, args) {
    this.slick_.invalidateRows(args.rows);
    this.slick_.render();
  }, this));

  // Filtering
  this.dataView_.onRowCountChanged.subscribe(goog.bind(function() {
    this.slick_.updateRowCount();
    this.slick_.render();
    this.updateTotals_();
    goog.style.showElement(this.noData_, this.dataView_.getLength() === 0);
  }, this));

  // Tooltips
  var ttShowHide = goog.bind(function(e, show) {
    var cell = this.slick_.getCellFromEvent(e);
    var spec = this.cols_[cell['cell']];
    if (!spec.tooltip) { return; }

    var cellNode = this.slick_.getCellNode(cell['row'], cell['cell']);
    var pos = goog.style.getPageOffset(cellNode);
    if (!show && this.tooltip_.isCoordinateInTooltip(pos)) { return; }
    var item = this.dataView_.getItem(cell['row']);
    var text = item[spec.dataColumn].replace(/\n/g, '<br/>');
    this.showTooltip_(text, pos, show);
  }, this);
  this.slick_.onMouseEnter.subscribe(function(e) { ttShowHide(e, true); });
  this.slick_.onMouseLeave.subscribe(function(e) { ttShowHide(e, false); });


  // Initialise
  this.dataView_.beginUpdate();
  this.dataView_.setItems(this.list_, 'ID');
  this.dataView_.setFilter(goog.bind(this.filterImpl_, this));
  this.dataView_.endUpdate();

  // Quick Filters
  if (this.cfg_.enableQuickFilters) {
    var rfr = goog.bind(function() {
      this.resizeFiltersRow_();
      this.saveGridState_();
    }, this);
    this.slick_.onColumnsReordered.subscribe(rfr);
    this.slick_.onColumnsResized.subscribe(rfr);
    this.initFiltersRow_();
  }

  if (this.cfg_.sortable) { this.setGridInitialSortState_(); }
  this.setGridInitialFilterState_();
};


/** @private */
pn.ui.grid.Grid.prototype.clearFilters_ = function() {
  this.quickFilters_ = {};
  goog.net.cookies.set('saved-quick-filters:' + this.hash_, '{}',
      60 * 60 * 24 * 90);
  $(this.slick_.getHeaderRow()).find(':input').val('');
  this.dataView_.refresh();
};


/** @private */
pn.ui.grid.Grid.prototype.setGridInitialFilterState_ = function() {
  var saved = goog.net.cookies.get('saved-quick-filters:' + this.hash_);
  if (!saved) return;
  var tmp = goog.json.unsafeParse(saved);
  if (goog.object.isEmpty(tmp)) return;
  for (var cid in tmp) {
    this.quickFilterControls_[cid].value = tmp[cid];
    this.quickFilters_[cid] = tmp[cid];
  }
  this.dataView_.refresh();
};


/**
 * @private
 * @param {string} col The column ID to sort by.
 * @param {boolean} asc Wether to sort ascending.
 */
pn.ui.grid.Grid.prototype.sortBy_ = function(col, asc) {
  this.sort_ = { 'colid': col, 'asc': asc };
  var col2 = goog.array.find(this.cols_, function(c) { return c.id === col; });
  var renderer = col2.renderer;

  this.dataView_.sort(function(a, b) {
    var x = renderer ? renderer(0, 0, a[col], col2, a) : a[col],
        y = renderer ? renderer(0, 0, b[col], col2, b) : b[col];
    if (col2['dateType']) {x=a[col];y=b[col];}
    return (x === y ? 0 : (x > y ? 1 : -1));
  }, asc);
};


/**
 * @private
 * @param {string} text The text to display in the tooltip.
 * @param {goog.math.Coordinate} pos The coordincate to display the tooltip at.
 * @param {boolean} show Wether we are showing or hiding this tooltip.
 */
pn.ui.grid.Grid.prototype.showTooltip_ = function(text, pos, show) {
  // Must be hidden even if we are to re-show it or else it causes usability
  // problems.
  this.tooltip_.setVisible(false);
  if (!show) { return; }
  this.tooltip_.setHtml(text);
  var position = new goog.positioning.AbsolutePosition(pos.x, pos.y);
  this.tooltip_.setPosition(position);
  this.tooltip_.setVisible(true);
};


/** @private */
pn.ui.grid.Grid.prototype.setGridInitialSortState_ = function() {
  var state = goog.net.cookies.get(this.hash_);
  var data = state ? goog.json.unsafeParse(state) : {};
  if (!data['sort']) {
    data['sort'] = { 'colid': this.cols_[0].id, 'asc': true };
  }
  this.sortBy_(data['sort']['colid'], data['sort']['asc']);
  this.slick_.setSortColumn(data['sort']['colid'], data['sort']['asc']);
};


/** @private */
pn.ui.grid.Grid.prototype.updateTotals_ = function() {
  if (!this.totalColumns_.length) return;
  // This multiplier is used to remove floating point problems.
  var mult = 1000000;
  var items = this.dataView_.getItems();
  var total = goog.array.reduce(items,
      function(acc, item) {
        goog.array.forEach(this.totalColumns_, function(c) {
          if (acc[c.id] === undefined) acc[c.id] = 0;
          var itemVal = item[c.id];
          if (goog.isNumber(itemVal)) {
            acc[c.id] += Math.floor(itemVal * mult);
          }
        }, this);
        return acc;
      }, {}, this);
  var html = [];
  for (var field in total) {
    var spec = goog.array.find(this.totalColumns_, function(c) {
      return c.id === field;
    });
    var val = total[field] / mult;
    if (spec.renderer) {
      val = spec.renderer(-1, -1, /** @type {Object} */ (val), spec, null);
    } else { val = this.totalsFormatter_.format(val); }
    html.push('Total ' + spec.name + ': ' + val);
  }
  this.totalsLegend_.innerHTML = '<ul><li>' +
      html.join('</li><li>') + '</li>';
};


/** @inheritDoc */
pn.ui.grid.Grid.prototype.exitDocument = function() {
  pn.ui.grid.Grid.superClass_.exitDocument.call(this);
  this.eh_.removeAll();
};


/** @private */
pn.ui.grid.Grid.prototype.initFiltersRow_ = function() {
  for (var i = 0; i < this.cols_.length; i++) {
    var col = this.cols_[i];
    var header = this.slick_.getHeaderRowColumn(col.id);
    var val = this.quickFilters_[col.id];
    var input = pn.ui.grid.QuickFilterHelpers.createFilterInput(col, 100, val);
    input['data-id'] = col.id;
    this.quickFilterControls_[col.id] = input;

    goog.dom.removeChildren(header);
    goog.dom.appendChild(header, input);
  }

  var that = this;
  $(this.slick_.getHeaderRow()).delegate(':input', 'change keyup',
      function() {
        that.quickFilters_[this['data-id']] = $.trim(
            /** @type {string} */ ($(this).val())).toLowerCase();
        goog.net.cookies.set('saved-quick-filters:' + that.hash_,
            goog.json.serialize(that.quickFilters_), 60 * 60 * 24 * 90);
        that.dataView_.refresh();
      });

  this.resizeFiltersRow_();
};


/** @private */
pn.ui.grid.Grid.prototype.saveGridState_ = function() {
  var columns = this.slick_.getColumns();
  var data = {
    'ids': goog.array.map(columns, function(c) { return c.id; }),
    'widths': goog.array.map(columns, function(c) { return c.width; }),
    'sort': this.sort_
  };
  goog.net.cookies.set(this.hash_,
      goog.json.serialize(data), 60 * 60 * 24 * 90);
};


/** @private */
pn.ui.grid.Grid.prototype.resizeFiltersRow_ = function() {
  var grid = /** @type {Element} */
      (this.slick_.getHeaderRow().parentNode.parentNode);
  var headerTemplates =
      goog.dom.getElementsByClass('slick-header-column', grid);
  for (var i = 0; i < this.cols_.length; i++) {
    var col = this.cols_[i];
    var header = this.slick_.getHeaderRowColumn(col.id);

    var input = goog.dom.getChildren(header)[0];
    var width = jQuery(headerTemplates[i]).width();
    goog.style.setWidth(header, width - 1);
    goog.style.setWidth(input, width - 3);

  }
};


/**
 * @private
 * @param {!Object} item the row data item.
 * @return {boolean} Wether the item meets the quick filters.
 */
pn.ui.grid.Grid.prototype.quickFilter_ = function(item) {
  for (var columnId in this.quickFilters_) {
    if (columnId && this.quickFilters_[columnId]) {
      var filterVal = this.quickFilters_[columnId];
      var spec = /** @type {pn.ui.grid.Column} */
          (goog.array.find(this.cols_,
              function(col) { return col.id === columnId; }));
      var val = item[spec.dataColumn];
      if (spec.isParentFormatter) {
        val = val ? this.getCachedEntityName_(spec, val) : '';
      } else if (spec.renderer) {
        val = spec.renderer(0, 0, val, spec, item);
      }
      if (goog.isDefAndNotNull(val)) { val = val.toString().toLowerCase(); }
      if (!goog.isDefAndNotNull(val) || val.indexOf(filterVal) < 0) {
        return false;
      }
    }
  }
  return true;
};


/**
 * @private
 * @param {Event} ev The selection event from the SlickGrid.
 * @param {Object} evData The data for the selection event.
 */
pn.ui.grid.Grid.prototype.handleSelection_ = function(ev, evData) {
  var idx = evData['rows'][0];
  var selected = this.dataView_.getItem(idx);
  if (this.cfg_.onselect) {
    this.cfg_.onselect(selected);
  } else {
    var e = new goog.events.Event(pn.ui.grid.Grid.EventType.ROW_SELECTED, this);
    e.selected = selected;
    this.dispatchEvent(e);
  }
};


/** @inheritDoc */
pn.ui.grid.Grid.prototype.disposeInternal = function() {
  pn.ui.grid.Grid.superClass_.disposeInternal.call(this);

  goog.array.forEach(this.commands_, goog.dispose);
  goog.array.forEach(this.cols_, goog.dispose);
  goog.object.forEach(this.quickFilters_, goog.dispose);
  goog.dispose(this.cfg_);
  if (this.slick_) this.slick_.destroy();
  goog.dispose(this.slick_);
  goog.dispose(this.dataView_);
  this.eh_.removeAll();
  goog.dispose(this.eh_);
  goog.dispose(this.log_);
  goog.dispose(this.noData_);
  goog.dispose(this.gridContainer_);
  goog.dispose(this.tooltip_);
  goog.dispose(this.totalsFormatter_);
  if (this.totalsLegend_) goog.dispose(this.totalsLegend_);
  delete this.quickFilters_;
  delete this.eh_;
  delete this.slick_;
  delete this.dataView_;
  delete this.cfg_;
  delete this.log_;
  delete this.totalsLegend_;
  delete this.list_;
  delete this.cols_;
  delete this.totalColumns_;
  delete this.cfg_;
  delete this.cache_;
  delete this.commands_;
  delete this.slick_;
  delete this.noData_;
  delete this.gridContainer_;
  delete this.selectionHandler_;
  delete this.currentFilter_;
  delete this.sort_;
  delete this.tooltip_;
  delete this.totalsFormatter_;
};


/**
 * @enum {string}
 */
pn.ui.grid.Grid.EventType = {
  ROW_SELECTED: 'row-selected',
  ADD: 'add',
  EXPORT_DATA: 'export-data',
  CLEAR_FILTERS: 'clear-filters'
};
