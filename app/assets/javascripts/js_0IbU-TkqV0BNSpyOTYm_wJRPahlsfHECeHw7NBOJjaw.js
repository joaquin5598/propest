/**
 * @name InfoBox
 * @version 1.1.12 [December 11, 2012]
 * @author Gary Little (inspired by proof-of-concept code from Pamela Fox of Google)
 * @copyright Copyright 2010 Gary Little [gary at luxcentral.com]
 * @fileoverview InfoBox extends the Google Maps JavaScript API V3 <tt>OverlayView</tt> class.
 *  <p>
 *  An InfoBox behaves like a <tt>google.maps.InfoWindow</tt>, but it supports several
 *  additional properties for advanced styling. An InfoBox can also be used as a map label.
 *  <p>
 *  An InfoBox also fires the same events as a <tt>google.maps.InfoWindow</tt>.
 */

/*!
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*jslint browser:true */
/*global google */

/**
 * @name InfoBoxOptions
 * @class This class represents the optional parameter passed to the {@link InfoBox} constructor.
 * @property {string|Node} content The content of the InfoBox (plain text or an HTML DOM node).
 * @property {boolean} [disableAutoPan=false] Disable auto-pan on <tt>open</tt>.
 * @property {number} maxWidth The maximum width (in pixels) of the InfoBox. Set to 0 if no maximum.
 * @property {Size} pixelOffset The offset (in pixels) from the top left corner of the InfoBox
 *  (or the bottom left corner if the <code>alignBottom</code> property is <code>true</code>)
 *  to the map pixel corresponding to <tt>position</tt>.
 * @property {LatLng} position The geographic location at which to display the InfoBox.
 * @property {number} zIndex The CSS z-index style value for the InfoBox.
 *  Note: This value overrides a zIndex setting specified in the <tt>boxStyle</tt> property.
 * @property {string} [boxClass="infoBox"] The name of the CSS class defining the styles for the InfoBox container.
 * @property {Object} [boxStyle] An object literal whose properties define specific CSS
 *  style values to be applied to the InfoBox. Style values defined here override those that may
 *  be defined in the <code>boxClass</code> style sheet. If this property is changed after the
 *  InfoBox has been created, all previously set styles (except those defined in the style sheet)
 *  are removed from the InfoBox before the new style values are applied.
 * @property {string} closeBoxMargin The CSS margin style value for the close box.
 *  The default is "2px" (a 2-pixel margin on all sides).
 * @property {string} closeBoxURL The URL of the image representing the close box.
 *  Note: The default is the URL for Google's standard close box.
 *  Set this property to "" if no close box is required.
 * @property {Size} infoBoxClearance Minimum offset (in pixels) from the InfoBox to the
 *  map edge after an auto-pan.
 * @property {boolean} [isHidden=false] Hide the InfoBox on <tt>open</tt>.
 *  [Deprecated in favor of the <tt>visible</tt> property.]
 * @property {boolean} [visible=true] Show the InfoBox on <tt>open</tt>.
 * @property {boolean} alignBottom Align the bottom left corner of the InfoBox to the <code>position</code>
 *  location (default is <tt>false</tt> which means that the top left corner of the InfoBox is aligned).
 * @property {string} pane The pane where the InfoBox is to appear (default is "floatPane").
 *  Set the pane to "mapPane" if the InfoBox is being used as a map label.
 *  Valid pane names are the property names for the <tt>google.maps.MapPanes</tt> object.
 * @property {boolean} enableEventPropagation Propagate mousedown, mousemove, mouseover, mouseout,
 *  mouseup, click, dblclick, touchstart, touchend, touchmove, and contextmenu events in the InfoBox
 *  (default is <tt>false</tt> to mimic the behavior of a <tt>google.maps.InfoWindow</tt>). Set
 *  this property to <tt>true</tt> if the InfoBox is being used as a map label.
 */

/**
 * Creates an InfoBox with the options specified in {@link InfoBoxOptions}.
 *  Call <tt>InfoBox.open</tt> to add the box to the map.
 * @constructor
 * @param {InfoBoxOptions} [opt_opts]
 */
function InfoBox(opt_opts) {

    opt_opts = opt_opts || {};

    google.maps.OverlayView.apply(this, arguments);

    // Standard options (in common with google.maps.InfoWindow):
    //
    this.content_ = opt_opts.content || "";
    this.disableAutoPan_ = opt_opts.disableAutoPan || false;
    this.maxWidth_ = opt_opts.maxWidth || 0;
    this.pixelOffset_ = opt_opts.pixelOffset || new google.maps.Size(0, 0);
    this.position_ = opt_opts.position || new google.maps.LatLng(0, 0);
    this.zIndex_ = opt_opts.zIndex || null;

    // Additional options (unique to InfoBox):
    //
    this.boxClass_ = opt_opts.boxClass || "infoBox";
    this.boxStyle_ = opt_opts.boxStyle || {};
    this.closeBoxMargin_ = opt_opts.closeBoxMargin || "2px";
    this.closeBoxURL_ = opt_opts.closeBoxURL || "http://www.google.com/intl/en_us/mapfiles/close.gif";
    if (opt_opts.closeBoxURL === "") {
        this.closeBoxURL_ = "";
    }
    this.infoBoxClearance_ = opt_opts.infoBoxClearance || new google.maps.Size(1, 1);

    if (typeof opt_opts.visible === "undefined") {
        if (typeof opt_opts.isHidden === "undefined") {
            opt_opts.visible = true;
        } else {
            opt_opts.visible = !opt_opts.isHidden;
        }
    }
    this.isHidden_ = !opt_opts.visible;

    this.alignBottom_ = opt_opts.alignBottom || false;
    this.pane_ = opt_opts.pane || "floatPane";
    this.enableEventPropagation_ = opt_opts.enableEventPropagation || false;

    this.div_ = null;
    this.closeListener_ = null;
    this.moveListener_ = null;
    this.contextListener_ = null;
    this.eventListeners_ = null;
    this.fixedWidthSet_ = null;
}

/* InfoBox extends OverlayView in the Google Maps API v3.
 */
InfoBox.prototype = new google.maps.OverlayView();

/**
 * Creates the DIV representing the InfoBox.
 * @private
 */
InfoBox.prototype.createInfoBoxDiv_ = function () {

    var i;
    var events;
    var bw;
    var me = this;

    // This handler prevents an event in the InfoBox from being passed on to the map.
    //
    var cancelHandler = function (e) {
        e.cancelBubble = true;
        if (e.stopPropagation) {
            e.stopPropagation();
        }
    };

    // This handler ignores the current event in the InfoBox and conditionally prevents
    // the event from being passed on to the map. It is used for the contextmenu event.
    //
    var ignoreHandler = function (e) {

        e.returnValue = false;

        if (e.preventDefault) {

            e.preventDefault();
        }

        if (!me.enableEventPropagation_) {

            cancelHandler(e);
        }
    };

    if (!this.div_) {

        this.div_ = document.createElement("div");

        this.setBoxStyle_();

        if (typeof this.content_.nodeType === "undefined") {
            this.div_.innerHTML = this.getCloseBoxImg_() + this.content_;
        } else {
            this.div_.innerHTML = this.getCloseBoxImg_();
            this.div_.appendChild(this.content_);
        }

        // Add the InfoBox DIV to the DOM
        this.getPanes()[this.pane_].appendChild(this.div_);

        this.addClickHandler_();

        if (this.div_.style.width) {

            this.fixedWidthSet_ = true;

        } else {

            if (this.maxWidth_ !== 0 && this.div_.offsetWidth > this.maxWidth_) {

                this.div_.style.width = this.maxWidth_;
                this.div_.style.overflow = "auto";
                this.fixedWidthSet_ = true;

            } else { // The following code is needed to overcome problems with MSIE

                bw = this.getBoxWidths_();

                this.div_.style.width = (this.div_.offsetWidth - bw.left - bw.right) + "px";
                this.fixedWidthSet_ = false;
            }
        }

        this.panBox_(this.disableAutoPan_);

        if (!this.enableEventPropagation_) {

            this.eventListeners_ = [];

            // Cancel event propagation.
            //
            // Note: mousemove not included (to resolve Issue 152)
            events = ["mousedown", "mouseover", "mouseout", "mouseup",
                "click", "dblclick", "touchstart", "touchend", "touchmove"];

            for (i = 0; i < events.length; i++) {

                this.eventListeners_.push(google.maps.event.addDomListener(this.div_, events[i], cancelHandler));
            }

            // Workaround for Google bug that causes the cursor to change to a pointer
            // when the mouse moves over a marker underneath InfoBox.
            this.eventListeners_.push(google.maps.event.addDomListener(this.div_, "mouseover", function (e) {
                this.style.cursor = "default";
            }));
        }

        this.contextListener_ = google.maps.event.addDomListener(this.div_, "contextmenu", ignoreHandler);

        /**
         * This event is fired when the DIV containing the InfoBox's content is attached to the DOM.
         * @name InfoBox#domready
         * @event
         */
        google.maps.event.trigger(this, "domready");
    }
};

/**
 * Returns the HTML <IMG> tag for the close box.
 * @private
 */
InfoBox.prototype.getCloseBoxImg_ = function () {

    var img = "";

    if (this.closeBoxURL_ !== "") {

        img  = "<img";
        img += " src='" + this.closeBoxURL_ + "'";
        img += " align=right"; // Do this because Opera chokes on style='float: right;'
        img += " style='";
        img += " position: relative;"; // Required by MSIE
        img += " cursor: pointer;";
        img += " margin: " + this.closeBoxMargin_ + ";";
        img += "'>";
    }

    return img;
};

/**
 * Adds the click handler to the InfoBox close box.
 * @private
 */
InfoBox.prototype.addClickHandler_ = function () {

    var closeBox;

    if (this.closeBoxURL_ !== "") {

        closeBox = this.div_.firstChild;
        this.closeListener_ = google.maps.event.addDomListener(closeBox, "click", this.getCloseClickHandler_());

    } else {

        this.closeListener_ = null;
    }
};

/**
 * Returns the function to call when the user clicks the close box of an InfoBox.
 * @private
 */
InfoBox.prototype.getCloseClickHandler_ = function () {

    var me = this;

    return function (e) {

        // 1.0.3 fix: Always prevent propagation of a close box click to the map:
        e.cancelBubble = true;

        if (e.stopPropagation) {

            e.stopPropagation();
        }

        /**
         * This event is fired when the InfoBox's close box is clicked.
         * @name InfoBox#closeclick
         * @event
         */
        google.maps.event.trigger(me, "closeclick");

        me.close();
    };
};

/**
 * Pans the map so that the InfoBox appears entirely within the map's visible area.
 * @private
 */
InfoBox.prototype.panBox_ = function (disablePan) {

    var map;
    var bounds;
    var xOffset = 0, yOffset = 0;

    if (!disablePan) {

        map = this.getMap();

        if (map instanceof google.maps.Map) { // Only pan if attached to map, not panorama

            if (!map.getBounds().contains(this.position_)) {
                // Marker not in visible area of map, so set center
                // of map to the marker position first.
                map.setCenter(this.position_);
            }

            bounds = map.getBounds();

            var mapDiv = map.getDiv();
            var mapWidth = mapDiv.offsetWidth;
            var mapHeight = mapDiv.offsetHeight;
            var iwOffsetX = this.pixelOffset_.width;
            var iwOffsetY = this.pixelOffset_.height;
            var iwWidth = this.div_.offsetWidth;
            var iwHeight = this.div_.offsetHeight;
            var padX = this.infoBoxClearance_.width;
            var padY = this.infoBoxClearance_.height;
            var pixPosition = this.getProjection().fromLatLngToContainerPixel(this.position_);

            if (pixPosition.x < (-iwOffsetX + padX)) {
                xOffset = pixPosition.x + iwOffsetX - padX;
            } else if ((pixPosition.x + iwWidth + iwOffsetX + padX) > mapWidth) {
                xOffset = pixPosition.x + iwWidth + iwOffsetX + padX - mapWidth;
            }
            if (this.alignBottom_) {
                if (pixPosition.y < (-iwOffsetY + padY + iwHeight)) {
                    yOffset = pixPosition.y + iwOffsetY - padY - iwHeight;
                } else if ((pixPosition.y + iwOffsetY + padY) > mapHeight) {
                    yOffset = pixPosition.y + iwOffsetY + padY - mapHeight;
                }
            } else {
                if (pixPosition.y < (-iwOffsetY + padY)) {
                    yOffset = pixPosition.y + iwOffsetY - padY;
                } else if ((pixPosition.y + iwHeight + iwOffsetY + padY) > mapHeight) {
                    yOffset = pixPosition.y + iwHeight + iwOffsetY + padY - mapHeight;
                }
            }

            if (!(xOffset === 0 && yOffset === 0)) {

                // Move the map to the shifted center.
                //
                var c = map.getCenter();
                map.panBy(xOffset, yOffset);
            }
        }
    }
};

/**
 * Sets the style of the InfoBox by setting the style sheet and applying
 * other specific styles requested.
 * @private
 */
InfoBox.prototype.setBoxStyle_ = function () {

    var i, boxStyle;

    if (this.div_) {

        // Apply style values from the style sheet defined in the boxClass parameter:
        this.div_.className = this.boxClass_;

        // Clear existing inline style values:
        this.div_.style.cssText = "";

        // Apply style values defined in the boxStyle parameter:
        boxStyle = this.boxStyle_;
        for (i in boxStyle) {

            if (boxStyle.hasOwnProperty(i)) {

                this.div_.style[i] = boxStyle[i];
            }
        }

        // Fix up opacity style for benefit of MSIE:
        //
        if (typeof this.div_.style.opacity !== "undefined" && this.div_.style.opacity !== "") {

            this.div_.style.filter = "alpha(opacity=" + (this.div_.style.opacity * 100) + ")";
        }

        // Apply required styles:
        //
        this.div_.style.position = "absolute";
        this.div_.style.visibility = 'hidden';
        if (this.zIndex_ !== null) {

            this.div_.style.zIndex = this.zIndex_;
        }
    }
};

/**
 * Get the widths of the borders of the InfoBox.
 * @private
 * @return {Object} widths object (top, bottom left, right)
 */
InfoBox.prototype.getBoxWidths_ = function () {

    var computedStyle;
    var bw = {top: 0, bottom: 0, left: 0, right: 0};
    var box = this.div_;

    if (document.defaultView && document.defaultView.getComputedStyle) {

        computedStyle = box.ownerDocument.defaultView.getComputedStyle(box, "");

        if (computedStyle) {

            // The computed styles are always in pixel units (good!)
            bw.top = parseInt(computedStyle.borderTopWidth, 10) || 0;
            bw.bottom = parseInt(computedStyle.borderBottomWidth, 10) || 0;
            bw.left = parseInt(computedStyle.borderLeftWidth, 10) || 0;
            bw.right = parseInt(computedStyle.borderRightWidth, 10) || 0;
        }

    } else if (document.documentElement.currentStyle) { // MSIE

        if (box.currentStyle) {

            // The current styles may not be in pixel units, but assume they are (bad!)
            bw.top = parseInt(box.currentStyle.borderTopWidth, 10) || 0;
            bw.bottom = parseInt(box.currentStyle.borderBottomWidth, 10) || 0;
            bw.left = parseInt(box.currentStyle.borderLeftWidth, 10) || 0;
            bw.right = parseInt(box.currentStyle.borderRightWidth, 10) || 0;
        }
    }

    return bw;
};

/**
 * Invoked when <tt>close</tt> is called. Do not call it directly.
 */
InfoBox.prototype.onRemove = function () {

    if (this.div_) {

        this.div_.parentNode.removeChild(this.div_);
        this.div_ = null;
    }
};

/**
 * Draws the InfoBox based on the current map projection and zoom level.
 */
InfoBox.prototype.draw = function () {

    this.createInfoBoxDiv_();

    var pixPosition = this.getProjection().fromLatLngToDivPixel(this.position_);

    this.div_.style.left = (pixPosition.x + this.pixelOffset_.width) + "px";

    if (this.alignBottom_) {
        this.div_.style.bottom = -(pixPosition.y + this.pixelOffset_.height) + "px";
    } else {
        this.div_.style.top = (pixPosition.y + this.pixelOffset_.height) + "px";
    }

    if (this.isHidden_) {

        this.div_.style.visibility = 'hidden';

    } else {

        this.div_.style.visibility = "visible";
    }
};

/**
 * Sets the options for the InfoBox. Note that changes to the <tt>maxWidth</tt>,
 *  <tt>closeBoxMargin</tt>, <tt>closeBoxURL</tt>, and <tt>enableEventPropagation</tt>
 *  properties have no affect until the current InfoBox is <tt>close</tt>d and a new one
 *  is <tt>open</tt>ed.
 * @param {InfoBoxOptions} opt_opts
 */
InfoBox.prototype.setOptions = function (opt_opts) {
    if (typeof opt_opts.boxClass !== "undefined") { // Must be first

        this.boxClass_ = opt_opts.boxClass;
        this.setBoxStyle_();
    }
    if (typeof opt_opts.boxStyle !== "undefined") { // Must be second

        this.boxStyle_ = opt_opts.boxStyle;
        this.setBoxStyle_();
    }
    if (typeof opt_opts.content !== "undefined") {

        this.setContent(opt_opts.content);
    }
    if (typeof opt_opts.disableAutoPan !== "undefined") {

        this.disableAutoPan_ = opt_opts.disableAutoPan;
    }
    if (typeof opt_opts.maxWidth !== "undefined") {

        this.maxWidth_ = opt_opts.maxWidth;
    }
    if (typeof opt_opts.pixelOffset !== "undefined") {

        this.pixelOffset_ = opt_opts.pixelOffset;
    }
    if (typeof opt_opts.alignBottom !== "undefined") {

        this.alignBottom_ = opt_opts.alignBottom;
    }
    if (typeof opt_opts.position !== "undefined") {

        this.setPosition(opt_opts.position);
    }
    if (typeof opt_opts.zIndex !== "undefined") {

        this.setZIndex(opt_opts.zIndex);
    }
    if (typeof opt_opts.closeBoxMargin !== "undefined") {

        this.closeBoxMargin_ = opt_opts.closeBoxMargin;
    }
    if (typeof opt_opts.closeBoxURL !== "undefined") {

        this.closeBoxURL_ = opt_opts.closeBoxURL;
    }
    if (typeof opt_opts.infoBoxClearance !== "undefined") {

        this.infoBoxClearance_ = opt_opts.infoBoxClearance;
    }
    if (typeof opt_opts.isHidden !== "undefined") {

        this.isHidden_ = opt_opts.isHidden;
    }
    if (typeof opt_opts.visible !== "undefined") {

        this.isHidden_ = !opt_opts.visible;
    }
    if (typeof opt_opts.enableEventPropagation !== "undefined") {

        this.enableEventPropagation_ = opt_opts.enableEventPropagation;
    }

    if (this.div_) {

        this.draw();
    }
};

/**
 * Sets the content of the InfoBox.
 *  The content can be plain text or an HTML DOM node.
 * @param {string|Node} content
 */
InfoBox.prototype.setContent = function (content) {
    this.content_ = content;

    if (this.div_) {

        if (this.closeListener_) {

            google.maps.event.removeListener(this.closeListener_);
            this.closeListener_ = null;
        }

        // Odd code required to make things work with MSIE.
        //
        if (!this.fixedWidthSet_) {

            this.div_.style.width = "";
        }

        if (typeof content.nodeType === "undefined") {
            this.div_.innerHTML = this.getCloseBoxImg_() + content;
        } else {
            this.div_.innerHTML = this.getCloseBoxImg_();
            this.div_.appendChild(content);
        }

        // Perverse code required to make things work with MSIE.
        // (Ensures the close box does, in fact, float to the right.)
        //
        if (!this.fixedWidthSet_) {
            this.div_.style.width = this.div_.offsetWidth + "px";
            if (typeof content.nodeType === "undefined") {
                this.div_.innerHTML = this.getCloseBoxImg_() + content;
            } else {
                this.div_.innerHTML = this.getCloseBoxImg_();
                this.div_.appendChild(content);
            }
        }

        this.addClickHandler_();
    }

    /**
     * This event is fired when the content of the InfoBox changes.
     * @name InfoBox#content_changed
     * @event
     */
    google.maps.event.trigger(this, "content_changed");
};

/**
 * Sets the geographic location of the InfoBox.
 * @param {LatLng} latlng
 */
InfoBox.prototype.setPosition = function (latlng) {

    this.position_ = latlng;

    if (this.div_) {

        this.draw();
    }

    /**
     * This event is fired when the position of the InfoBox changes.
     * @name InfoBox#position_changed
     * @event
     */
    google.maps.event.trigger(this, "position_changed");
};

/**
 * Sets the zIndex style for the InfoBox.
 * @param {number} index
 */
InfoBox.prototype.setZIndex = function (index) {

    this.zIndex_ = index;

    if (this.div_) {

        this.div_.style.zIndex = index;
    }

    /**
     * This event is fired when the zIndex of the InfoBox changes.
     * @name InfoBox#zindex_changed
     * @event
     */
    google.maps.event.trigger(this, "zindex_changed");
};

/**
 * Sets the visibility of the InfoBox.
 * @param {boolean} isVisible
 */
InfoBox.prototype.setVisible = function (isVisible) {

    this.isHidden_ = !isVisible;
    if (this.div_) {
        this.div_.style.visibility = (this.isHidden_ ? "hidden" : "visible");
    }
};

/**
 * Returns the content of the InfoBox.
 * @returns {string}
 */
InfoBox.prototype.getContent = function () {

    return this.content_;
};

/**
 * Returns the geographic location of the InfoBox.
 * @returns {LatLng}
 */
InfoBox.prototype.getPosition = function () {

    return this.position_;
};

/**
 * Returns the zIndex for the InfoBox.
 * @returns {number}
 */
InfoBox.prototype.getZIndex = function () {

    return this.zIndex_;
};

/**
 * Returns a flag indicating whether the InfoBox is visible.
 * @returns {boolean}
 */
InfoBox.prototype.getVisible = function () {

    var isVisible;

    if ((typeof this.getMap() === "undefined") || (this.getMap() === null)) {
        isVisible = false;
    } else {
        isVisible = !this.isHidden_;
    }
    return isVisible;
};

/**
 * Shows the InfoBox. [Deprecated; use <tt>setVisible</tt> instead.]
 */
InfoBox.prototype.show = function () {

    this.isHidden_ = false;
    if (this.div_) {
        this.div_.style.visibility = "visible";
    }
};

/**
 * Hides the InfoBox. [Deprecated; use <tt>setVisible</tt> instead.]
 */
InfoBox.prototype.hide = function () {

    this.isHidden_ = true;
    if (this.div_) {
        this.div_.style.visibility = "hidden";
    }
};

/**
 * Adds the InfoBox to the specified map or Street View panorama. If <tt>anchor</tt>
 *  (usually a <tt>google.maps.Marker</tt>) is specified, the position
 *  of the InfoBox is set to the position of the <tt>anchor</tt>. If the
 *  anchor is dragged to a new location, the InfoBox moves as well.
 * @param {Map|StreetViewPanorama} map
 * @param {MVCObject} [anchor]
 */
InfoBox.prototype.open = function (map, anchor) {

    var me = this;

    if (anchor) {

        this.position_ = anchor.getPosition();
        this.moveListener_ = google.maps.event.addListener(anchor, "position_changed", function () {
            me.setPosition(this.getPosition());
        });
    }
    this.setMap(map);

    if (this.div_) {

        this.panBox_();
    }
};

/**
 * Removes the InfoBox from the map.
 */
InfoBox.prototype.close = function () {

    var i;

    if (this.closeListener_) {

        google.maps.event.removeListener(this.closeListener_);
        this.closeListener_ = null;
    }

    if (this.eventListeners_) {

        for (i = 0; i < this.eventListeners_.length; i++) {

            google.maps.event.removeListener(this.eventListeners_[i]);
        }
        this.eventListeners_ = null;
    }

    if (this.moveListener_) {

        google.maps.event.removeListener(this.moveListener_);
        this.moveListener_ = null;
    }

    if (this.contextListener_) {

        google.maps.event.removeListener(this.contextListener_);
        this.contextListener_ = null;
    }

    this.setMap(null);
};
;
/**
 * @name StyledMarkerMaker
 * @version 0.5
 * @author Gabriel Schneider
 * @copyright (c) 2010 Gabriel Schneider
 * @fileoverview This gives you static functions for creating dynamically
 *     styled markers using Charts API outputs as well as an ability to
 *     extend with custom types.
 */

/**
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var StyledIconTypes = {};
var StyledMarker, StyledIcon;

/**
 * @param {Function} childCtor Child class.
 * @param {Function} parentCtor Parent class.
 */
function inherits(childCtor, parentCtor) {
    /** @constructor */
    function tempCtor() {};
    tempCtor.prototype = parentCtor.prototype;
    childCtor.superClass_ = parentCtor.prototype;
    childCtor.prototype = new tempCtor();
    /** @override */
    childCtor.prototype.constructor = childCtor;
}

(function() {
    var bu_ = 'https://chart.googleapis.com/chart?chst=';
    var gm_ = google.maps;
    var gp_ = gm_.Point;
    var ge_ = gm_.event;
    var gmi_ = gm_.MarkerImage;


    /**
     * This class is an extended version of google.maps.Marker. It allows
     * styles to be applied that change it's appearance.
     * @extends google.maps.Marker
     * @param {StyledMarkerOptions} StyledMarkerOptions The options for the Marker
     */
    StyledMarker = function(styledMarkerOptions) {
        gm_.Marker.call(this);
        var me=this;
        var ci = me.styleIcon = styledMarkerOptions.styleIcon;
        me.bindTo('icon',ci);
        me.bindTo('shadow',ci);
        me.bindTo('shape',ci);
        me.setOptions(styledMarkerOptions);
    };
    inherits(StyledMarker, gm_.Marker);

    /**
     * This class stores style information that can be applied to StyledMarkers.
     * @extends google.maps.MVCObject
     * @param {StyledIconType} styledIconType The type of style this icon is.
     * @param {StyledIconOptions} styledIconOptions The options for this StyledIcon.
     * @param {StyledIcon} styleClass A class to apply extended style information.
     */
    StyledIcon = function(styledIconType,styledIconOptions,styleClass) {
        var k;
        var me=this;
        var i_ = 'icon';
        var sw_ = 'shadow';
        var s_ = 'shape';
        var a_ = [];

        function gs_() {
            var image_ = document.createElement('img');
            var simage_ = document.createElement('img');
            ge_.addDomListenerOnce(simage_, 'load', function() {
                var w = simage_.width, h = simage_.height;
                me.set(sw_,new gmi_(styledIconType.getShadowURL(me),null,null,styledIconType.getShadowAnchor(me,w,h)));
                simage = null;
            });
            ge_.addDomListenerOnce(image_, 'load', function() {
                var w = image_.width, h = image_.height;
                me.set(i_,new gmi_(styledIconType.getURL(me),null,null,styledIconType.getAnchor(me,w,h)));
                me.set(s_,styledIconType.getShape(me,w,h));
                image_ = null;
            });
            image_.src = styledIconType.getURL(me);
            simage_.src = styledIconType.getShadowURL(me);
        }

        /**
         * set:
         * This function sets a given style property to the given value.
         * @param {String} name The name of the property to set.
         * @param {Object} value The value to set the property to.
         * get:
         * This function gets a given style property.
         * @param {String} name The name of the property to get.
         * @return {Object}
         */
        me.as_ = function(v) {
            a_.push(v);
            for(k in styledIconOptions) {
                v.set(k, styledIconOptions[k]);
            }
        }

        if (styledIconType !== StyledIconTypes.CLASS) {
            for (k in styledIconType.defaults) {
                me.set(k, styledIconType.defaults[k]);
            }
            me.setValues(styledIconOptions);
            me.set(i_,styledIconType.getURL(me));
            me.set(sw_,styledIconType.getShadowURL(me));
            if (styleClass) styleClass.as_(me);
            gs_();
            me.changed = function(k) {
                if (k!==i_&&k!==s_&&k!==sw_) {
                    gs_();
                }
            };
        } else {
            me.setValues(styledIconOptions);
            me.changed = function(v) {
                styledIconOptions[v] = me.get(v);
                for (k = 0; k < a_.length; k++) {
                    a_[k].set(v,me.get(v));
                }
            };
            if (styleClass) styleClass.as_(me);
        }
    };
    StyledIcon.prototype = new gm_.MVCObject();

    /**
     * StyledIconType
     * This class holds functions for building the information needed to style markers.
     * getURL:
     * This function builds and returns a URL to use for the Marker icon property.
     * @param {StyledIcon} icon The StyledIcon that holds style information
     * @return {String}
     * getShadowURL:
     * This function builds and returns a URL to use for the Marker shadow property.
     * @param {StyledIcon} icon The StyledIcon that holds style information
     * @return {String{
  * getAnchor:
  * This function builds and returns a Point to indicate where the marker is placed.
  * @param {StyledIcon} icon The StyledIcon that holds style information
     * @param {Number} width The width of the icon image.
     * @param {Number} height The height of the icon image.
     * @return {google.maps.Point}
     * getShadowAnchor:
     * This function builds and returns a Point to indicate where the shadow is placed.
     * @param {StyledIcon} icon The StyledIcon that holds style information
     * @param {Number} width The width of the shadow image.
     * @param {Number} height The height of the shadow image.
     * @return {google.maps.Point}
     * getShape:
     * This function builds and returns a MarkerShape to indicate where the Marker is clickable.
     * @param {StyledIcon} icon The StyledIcon that holds style information
     * @param {Number} width The width of the icon image.
     * @param {Number} height The height of the icon image.
     * @return {google.maps.MarkerShape}
     */

    StyledIconTypes.CLASS = {};

    StyledIconTypes.MARKER = {
        defaults: {
            text:'',
            color:'00ff00',
            fore:'000000',
            starcolor:null
        },
        getURL: function(props){
            var _url;
            var starcolor_=props.get('starcolor');
            var text_=props.get('text');
            var color_=props.get('color').replace(/#/,'');
            var fore_=props.get('fore').replace(/#/,'');
            if (starcolor_) {
                _url = bu_ + 'd_map_xpin_letter&chld=pin_star|';
            } else {
                _url = bu_ + 'd_map_pin_letter&chld=';
            }
            if (text_) {
                text_ = text_.substr(0,2);
            }
            _url+=text_+'|';
            _url+=color_+'|';
            _url+=fore_;
            if (starcolor_) {
                _url+='|'+starcolor_.replace(/#/,'');
            }
            return _url;
        },
        getShadowURL: function(props){
            if (props.get('starcolor')) {
                return bu_ + 'd_map_xpin_shadow&chld=pin_star';
            } else {
                return bu_ + 'd_map_pin_shadow';
            }
        },
        getAnchor: function(props,width,height){
            return new gp_(width / 2,height);
        },
        getShadowAnchor: function(props,width,height){
            return new gp_(width / 4,height);
        },
        getShape: function(props,width,height){
            var _iconmap = {};
            _iconmap.coord = [
                width / 2, height,
                (7 / 16) * width, (5 / 8) * height,
                (5 / 16) * width, (7 / 16) * height,
                (7 / 32) * width, (5 / 16) * height,
                (5 / 16) * width, (1 / 8) * height,
                (1 / 2) * width, 0,
                (11 / 16) * width, (1 / 8) * height,
                (25 / 32) * width, (5 / 16) * height,
                (11 / 16) * width, (7 / 16) * height,
                (9 / 16) * width, (5 / 8) * height
            ];
            for (var i = 0; i < _iconmap.coord.length; i++) {
                _iconmap.coord[i] = Math.round(_iconmap.coord[i]);
            }
            _iconmap.type = 'poly';
            return _iconmap;
        }
    };
    StyledIconTypes.BUBBLE = {
        defaults: {
            text:'',
            color:'00ff00',
            fore:'000000'
        },
        getURL: function(props){
            var _url = bu_ + 'd_bubble_text_small&chld=bb|';
            _url+=props.get('text')+'|';
            _url+=props.get('color').replace(/#/,'')+'|';
            _url+=props.get('fore').replace(/#/,'');
            return _url;
        },
        getShadowURL: function(props){
            return bu_ + 'd_bubble_text_small_shadow&chld=bb|' + props.get('text');
        },
        getAnchor: function(props,width,height){
            return new google.maps.Point(0,42);
        },
        getShadowAnchor: function(props,width,height){
            return new google.maps.Point(0,44);
        },
        getShape: function(props,width,height){
            var _iconmap = {};
            _iconmap.coord = [
                0,44,
                13,26,
                13,6,
                17,1,
                width - 4,1,
                width,6,
                width,21,
                width - 4,26,
                21,26
            ];
            _iconmap.type = 'poly';
            return _iconmap;
        }
    };
})();

;
/*jslint browser: true, confusion: true, sloppy: true, vars: true, nomen: false, plusplus: false, indent: 2 */
/*global window,google */

/**
 * @name MarkerClustererPlus for Google Maps V3
 * @version 2.0.15 [October 18, 2012]
 * @author Gary Little
 * @fileoverview
 * The library creates and manages per-zoom-level clusters for large amounts of markers.
 * <p>
 * This is an enhanced V3 implementation of the
 * <a href="http://gmaps-utility-library-dev.googlecode.com/svn/tags/markerclusterer/"
 * >V2 MarkerClusterer</a> by Xiaoxi Wu. It is based on the
 * <a href="http://google-maps-utility-library-v3.googlecode.com/svn/tags/markerclusterer/"
 * >V3 MarkerClusterer</a> port by Luke Mahe. MarkerClustererPlus was created by Gary Little.
 * <p>
 * v2.0 release: MarkerClustererPlus v2.0 is backward compatible with MarkerClusterer v1.0. It
 *  adds support for the <code>ignoreHidden</code>, <code>title</code>, <code>printable</code>,
 *  <code>batchSizeIE</code>, and <code>calculator</code> properties as well as support for
 *  four more events. It also allows greater control over the styling of the text that appears
 *  on the cluster marker. The documentation has been significantly improved and the overall
 *  code has been simplified and polished. Very large numbers of markers can now be managed
 *  without causing Javascript timeout errors on Internet Explorer. Note that the name of the
 *  <code>clusterclick</code> event has been deprecated. The new name is <code>click</code>,
 *  so please change your application code now.
 */

/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * @name ClusterIconStyle
 * @class This class represents the object for values in the <code>styles</code> array passed
 *  to the {@link MarkerClusterer} constructor. The element in this array that is used to
 *  style the cluster icon is determined by calling the <code>calculator</code> function.
 *
 * @property {string} url The URL of the cluster icon image file. Required.
 * @property {number} height The height (in pixels) of the cluster icon. Required.
 * @property {number} width The width (in pixels) of the cluster icon. Required.
 * @property {Array} [anchor] The anchor position (in pixels) of the label text to be shown on
 *  the cluster icon, relative to the top left corner of the icon.
 *  The format is <code>[yoffset, xoffset]</code>. The <code>yoffset</code> must be positive
 *  and less than <code>height</code> and the <code>xoffset</code> must be positive and less
 *  than <code>width</code>. The default is to anchor the label text so that it is centered
 *  on the icon.
 * @property {Array} [anchorIcon] The anchor position (in pixels) of the cluster icon. This is the
 *  spot on the cluster icon that is to be aligned with the cluster position. The format is
 *  <code>[yoffset, xoffset]</code> where <code>yoffset</code> increases as you go down and
 *  <code>xoffset</code> increases to the right. The default anchor position is the center of the
 *  cluster icon.
 * @property {string} [textColor="black"] The color of the label text shown on the
 *  cluster icon.
 * @property {number} [textSize=11] The size (in pixels) of the label text shown on the
 *  cluster icon.
 * @property {number} [textDecoration="none"] The value of the CSS <code>text-decoration</code>
 *  property for the label text shown on the cluster icon.
 * @property {number} [fontWeight="bold"] The value of the CSS <code>font-weight</code>
 *  property for the label text shown on the cluster icon.
 * @property {number} [fontStyle="normal"] The value of the CSS <code>font-style</code>
 *  property for the label text shown on the cluster icon.
 * @property {number} [fontFamily="Arial,sans-serif"] The value of the CSS <code>font-family</code>
 *  property for the label text shown on the cluster icon.
 * @property {string} [backgroundPosition="0 0"] The position of the cluster icon image
 *  within the image defined by <code>url</code>. The format is <code>"xpos ypos"</code>
 *  (the same format as for the CSS <code>background-position</code> property). You must set
 *  this property appropriately when the image defined by <code>url</code> represents a sprite
 *  containing multiple images.
 */
/**
 * @name ClusterIconInfo
 * @class This class is an object containing general information about a cluster icon. This is
 *  the object that a <code>calculator</code> function returns.
 *
 * @property {string} text The text of the label to be shown on the cluster icon.
 * @property {number} index The index plus 1 of the element in the <code>styles</code>
 *  array to be used to style the cluster icon.
 * @property {string} title The tooltip to display when the mouse moves over the cluster icon.
 *  If this value is <code>undefined</code> or <code>""</code>, <code>title</code> is set to the
 *  value of the <code>title</code> property passed to the MarkerClusterer.
 */
/**
 * A cluster icon.
 *
 * @constructor
 * @extends google.maps.OverlayView
 * @param {Cluster} cluster The cluster with which the icon is to be associated.
 * @param {Array} [styles] An array of {@link ClusterIconStyle} defining the cluster icons
 *  to use for various cluster sizes.
 * @private
 */
function ClusterIcon(cluster, styles) {
    cluster.getMarkerClusterer().extend(ClusterIcon, google.maps.OverlayView);

    this.cluster_ = cluster;
    this.className_ = cluster.getMarkerClusterer().getClusterClass();
    this.styles_ = styles;
    this.center_ = null;
    this.div_ = null;
    this.sums_ = null;
    this.visible_ = false;

    this.setMap(cluster.getMap()); // Note: this causes onAdd to be called
}


/**
 * Adds the icon to the DOM.
 */
ClusterIcon.prototype.onAdd = function () {
    var cClusterIcon = this;
    var cMouseDownInCluster;
    var cDraggingMapByCluster;

    this.div_ = document.createElement("div");
    this.div_.className = this.className_;
    if (this.visible_) {
        this.show();
    }

    this.getPanes().overlayMouseTarget.appendChild(this.div_);

    // Fix for Issue 157
    google.maps.event.addListener(this.getMap(), "bounds_changed", function () {
        cDraggingMapByCluster = cMouseDownInCluster;
    });

    google.maps.event.addDomListener(this.div_, "mousedown", function () {
        cMouseDownInCluster = true;
        cDraggingMapByCluster = false;
    });

    google.maps.event.addDomListener(this.div_, "click", function (e) {
        cMouseDownInCluster = false;
        if (!cDraggingMapByCluster) {
            var theBounds;
            var mz;
            var mc = cClusterIcon.cluster_.getMarkerClusterer();
            /**
             * This event is fired when a cluster marker is clicked.
             * @name MarkerClusterer#click
             * @param {Cluster} c The cluster that was clicked.
             * @event
             */
            google.maps.event.trigger(mc, "click", cClusterIcon.cluster_);
            google.maps.event.trigger(mc, "clusterclick", cClusterIcon.cluster_); // deprecated name

            // The default click handler follows. Disable it by setting
            // the zoomOnClick property to false.
            if (mc.getZoomOnClick()) {
                // Zoom into the cluster.
                mz = mc.getMaxZoom();
                theBounds = cClusterIcon.cluster_.getBounds();
                mc.getMap().fitBounds(theBounds);
                // There is a fix for Issue 170 here:
                setTimeout(function () {
                    mc.getMap().fitBounds(theBounds);
                    // Don't zoom beyond the max zoom level
                    if (mz !== null && (mc.getMap().getZoom() > mz)) {
                        mc.getMap().setZoom(mz + 1);
                    }
                }, 100);
            }

            // Prevent event propagation to the map:
            e.cancelBubble = true;
            if (e.stopPropagation) {
                e.stopPropagation();
            }
        }
    });

    google.maps.event.addDomListener(this.div_, "mouseover", function () {
        var mc = cClusterIcon.cluster_.getMarkerClusterer();
        /**
         * This event is fired when the mouse moves over a cluster marker.
         * @name MarkerClusterer#mouseover
         * @param {Cluster} c The cluster that the mouse moved over.
         * @event
         */
        google.maps.event.trigger(mc, "mouseover", cClusterIcon.cluster_);
    });

    google.maps.event.addDomListener(this.div_, "mouseout", function () {
        var mc = cClusterIcon.cluster_.getMarkerClusterer();
        /**
         * This event is fired when the mouse moves out of a cluster marker.
         * @name MarkerClusterer#mouseout
         * @param {Cluster} c The cluster that the mouse moved out of.
         * @event
         */
        google.maps.event.trigger(mc, "mouseout", cClusterIcon.cluster_);
    });
};


/**
 * Removes the icon from the DOM.
 */
ClusterIcon.prototype.onRemove = function () {
    if (this.div_ && this.div_.parentNode) {
        this.hide();
        google.maps.event.clearInstanceListeners(this.div_);
        this.div_.parentNode.removeChild(this.div_);
        this.div_ = null;
    }
};


/**
 * Draws the icon.
 */
ClusterIcon.prototype.draw = function () {
    if (this.visible_) {
        var pos = this.getPosFromLatLng_(this.center_);
        this.div_.style.top = pos.y + "px";
        this.div_.style.left = pos.x + "px";
    }
};


/**
 * Hides the icon.
 */
ClusterIcon.prototype.hide = function () {
    if (this.div_) {
        this.div_.style.display = "none";
    }
    this.visible_ = false;
};


/**
 * Positions and shows the icon.
 */
ClusterIcon.prototype.show = function () {
    if (this.div_) {
        var pos = this.getPosFromLatLng_(this.center_);
        this.div_.style.cssText = this.createCss(pos);
        if (this.cluster_.printable_) {
            // (Would like to use "width: inherit;" below, but doesn't work with MSIE)
            this.div_.innerHTML = "<img src='" + this.url_ + "'><div style='position: absolute; top: 0px; left: 0px; width: " + this.width_ + "px;'>" + this.sums_.text + "</div>";
        } else {
            this.div_.innerHTML = this.sums_.text;
        }
        if (typeof this.sums_.title === "undefined" || this.sums_.title === "") {
            this.div_.title = this.cluster_.getMarkerClusterer().getTitle();
        } else {
            this.div_.title = this.sums_.title;
        }
        this.div_.style.display = "";
    }
    this.visible_ = true;
};


/**
 * Sets the icon styles to the appropriate element in the styles array.
 *
 * @param {ClusterIconInfo} sums The icon label text and styles index.
 */
ClusterIcon.prototype.useStyle = function (sums) {
    this.sums_ = sums;
    var index = Math.max(0, sums.index - 1);
    index = Math.min(this.styles_.length - 1, index);
    var style = this.styles_[index];
    this.url_ = style.url;
    this.height_ = style.height;
    this.width_ = style.width;
    this.anchor_ = style.anchor;
    this.anchorIcon_ = style.anchorIcon || [parseInt(this.height_ / 2, 10), parseInt(this.width_ / 2, 10)];
    this.textColor_ = style.textColor || "black";
    this.textSize_ = style.textSize || 11;
    this.textDecoration_ = style.textDecoration || "none";
    this.fontWeight_ = style.fontWeight || "bold";
    this.fontStyle_ = style.fontStyle || "normal";
    this.fontFamily_ = style.fontFamily || "Arial,sans-serif";
    this.backgroundPosition_ = style.backgroundPosition || "0 0";
};


/**
 * Sets the position at which to center the icon.
 *
 * @param {google.maps.LatLng} center The latlng to set as the center.
 */
ClusterIcon.prototype.setCenter = function (center) {
    this.center_ = center;
};


/**
 * Creates the cssText style parameter based on the position of the icon.
 *
 * @param {google.maps.Point} pos The position of the icon.
 * @return {string} The CSS style text.
 */
ClusterIcon.prototype.createCss = function (pos) {
    var style = [];
    if (!this.cluster_.printable_) {
        style.push('background-image:url(' + this.url_ + ');');
        style.push('background-position:' + this.backgroundPosition_ + ';');
    }

    if (typeof this.anchor_ === 'object') {
        if (typeof this.anchor_[0] === 'number' && this.anchor_[0] > 0 &&
            this.anchor_[0] < this.height_) {
            style.push('height:' + (this.height_ - this.anchor_[0]) +
                'px; padding-top:' + this.anchor_[0] + 'px;');
        } else {
            style.push('height:' + this.height_ + 'px; line-height:' + this.height_ +
                'px;');
        }
        if (typeof this.anchor_[1] === 'number' && this.anchor_[1] > 0 &&
            this.anchor_[1] < this.width_) {
            style.push('width:' + (this.width_ - this.anchor_[1]) +
                'px; padding-left:' + this.anchor_[1] + 'px;');
        } else {
            style.push('width:' + this.width_ + 'px; text-align:center;');
        }
    } else {
        style.push('height:' + this.height_ + 'px; line-height:' +
            this.height_ + 'px; width:' + this.width_ + 'px; text-align:center;');
    }

    style.push('cursor:pointer; top:' + pos.y + 'px; left:' +
        pos.x + 'px; color:' + this.textColor_ + '; position:absolute; font-size:' +
        this.textSize_ + 'px; font-family:' + this.fontFamily_ + '; font-weight:' +
        this.fontWeight_ + '; font-style:' + this.fontStyle_ + '; text-decoration:' +
        this.textDecoration_ + ';');

    return style.join("");
};


/**
 * Returns the position at which to place the DIV depending on the latlng.
 *
 * @param {google.maps.LatLng} latlng The position in latlng.
 * @return {google.maps.Point} The position in pixels.
 */
ClusterIcon.prototype.getPosFromLatLng_ = function (latlng) {
    var pos = this.getProjection().fromLatLngToDivPixel(latlng);
    pos.x -= this.anchorIcon_[1];
    pos.y -= this.anchorIcon_[0];
    return pos;
};


/**
 * Creates a single cluster that manages a group of proximate markers.
 *  Used internally, do not call this constructor directly.
 * @constructor
 * @param {MarkerClusterer} mc The <code>MarkerClusterer</code> object with which this
 *  cluster is associated.
 */
function Cluster(mc) {
    this.markerClusterer_ = mc;
    this.map_ = mc.getMap();
    this.gridSize_ = mc.getGridSize();
    this.minClusterSize_ = mc.getMinimumClusterSize();
    this.averageCenter_ = mc.getAverageCenter();
    this.printable_ = mc.getPrintable();
    this.markers_ = [];
    this.center_ = null;
    this.bounds_ = null;
    this.clusterIcon_ = new ClusterIcon(this, mc.getStyles());
}


/**
 * Returns the number of markers managed by the cluster. You can call this from
 * a <code>click</code>, <code>mouseover</code>, or <code>mouseout</code> event handler
 * for the <code>MarkerClusterer</code> object.
 *
 * @return {number} The number of markers in the cluster.
 */
Cluster.prototype.getSize = function () {
    return this.markers_.length;
};


/**
 * Returns the array of markers managed by the cluster. You can call this from
 * a <code>click</code>, <code>mouseover</code>, or <code>mouseout</code> event handler
 * for the <code>MarkerClusterer</code> object.
 *
 * @return {Array} The array of markers in the cluster.
 */
Cluster.prototype.getMarkers = function () {
    return this.markers_;
};


/**
 * Returns the center of the cluster. You can call this from
 * a <code>click</code>, <code>mouseover</code>, or <code>mouseout</code> event handler
 * for the <code>MarkerClusterer</code> object.
 *
 * @return {google.maps.LatLng} The center of the cluster.
 */
Cluster.prototype.getCenter = function () {
    return this.center_;
};


/**
 * Returns the map with which the cluster is associated.
 *
 * @return {google.maps.Map} The map.
 * @ignore
 */
Cluster.prototype.getMap = function () {
    return this.map_;
};


/**
 * Returns the <code>MarkerClusterer</code> object with which the cluster is associated.
 *
 * @return {MarkerClusterer} The associated marker clusterer.
 * @ignore
 */
Cluster.prototype.getMarkerClusterer = function () {
    return this.markerClusterer_;
};


/**
 * Returns the bounds of the cluster.
 *
 * @return {google.maps.LatLngBounds} the cluster bounds.
 * @ignore
 */
Cluster.prototype.getBounds = function () {
    var i;
    var bounds = new google.maps.LatLngBounds(this.center_, this.center_);
    var markers = this.getMarkers();
    for (i = 0; i < markers.length; i++) {
        bounds.extend(markers[i].getPosition());
    }
    return bounds;
};


/**
 * Removes the cluster from the map.
 *
 * @ignore
 */
Cluster.prototype.remove = function () {
    this.clusterIcon_.setMap(null);
    this.markers_ = [];
    delete this.markers_;
};


/**
 * Adds a marker to the cluster.
 *
 * @param {google.maps.Marker} marker The marker to be added.
 * @return {boolean} True if the marker was added.
 * @ignore
 */
Cluster.prototype.addMarker = function (marker) {
    var i;
    var mCount;
    var mz;

    if (this.isMarkerAlreadyAdded_(marker)) {
        return false;
    }

    if (!this.center_) {
        this.center_ = marker.getPosition();
        this.calculateBounds_();
    } else {
        if (this.averageCenter_) {
            var l = this.markers_.length + 1;
            var lat = (this.center_.lat() * (l - 1) + marker.getPosition().lat()) / l;
            var lng = (this.center_.lng() * (l - 1) + marker.getPosition().lng()) / l;
            this.center_ = new google.maps.LatLng(lat, lng);
            this.calculateBounds_();
        }
    }

    marker.isAdded = true;
    this.markers_.push(marker);

    mCount = this.markers_.length;
    mz = this.markerClusterer_.getMaxZoom();
    if (mz !== null && this.map_.getZoom() > mz) {
        // Zoomed in past max zoom, so show the marker.
        if (marker.getMap() !== this.map_) {
            marker.setMap(this.map_);
        }
    } else if (mCount < this.minClusterSize_) {
        // Min cluster size not reached so show the marker.
        if (marker.getMap() !== this.map_) {
            marker.setMap(this.map_);
        }
    } else if (mCount === this.minClusterSize_) {
        // Hide the markers that were showing.
        for (i = 0; i < mCount; i++) {
            this.markers_[i].setMap(null);
        }
    } else {
        marker.setMap(null);
    }

    this.updateIcon_();
    return true;
};


/**
 * Determines if a marker lies within the cluster's bounds.
 *
 * @param {google.maps.Marker} marker The marker to check.
 * @return {boolean} True if the marker lies in the bounds.
 * @ignore
 */
Cluster.prototype.isMarkerInClusterBounds = function (marker) {
    return this.bounds_.contains(marker.getPosition());
};


/**
 * Calculates the extended bounds of the cluster with the grid.
 */
Cluster.prototype.calculateBounds_ = function () {
    var bounds = new google.maps.LatLngBounds(this.center_, this.center_);
    this.bounds_ = this.markerClusterer_.getExtendedBounds(bounds);
};


/**
 * Updates the cluster icon.
 */
Cluster.prototype.updateIcon_ = function () {
    var mCount = this.markers_.length;
    var mz = this.markerClusterer_.getMaxZoom();

    if (mz !== null && this.map_.getZoom() > mz) {
        this.clusterIcon_.hide();
        return;
    }

    if (mCount < this.minClusterSize_) {
        // Min cluster size not yet reached.
        this.clusterIcon_.hide();
        return;
    }

    var numStyles = this.markerClusterer_.getStyles().length;
    var sums = this.markerClusterer_.getCalculator()(this.markers_, numStyles);
    this.clusterIcon_.setCenter(this.center_);
    this.clusterIcon_.useStyle(sums);
    this.clusterIcon_.show();
};


/**
 * Determines if a marker has already been added to the cluster.
 *
 * @param {google.maps.Marker} marker The marker to check.
 * @return {boolean} True if the marker has already been added.
 */
Cluster.prototype.isMarkerAlreadyAdded_ = function (marker) {
    var i;
    if (this.markers_.indexOf) {
        return this.markers_.indexOf(marker) !== -1;
    } else {
        for (i = 0; i < this.markers_.length; i++) {
            if (marker === this.markers_[i]) {
                return true;
            }
        }
    }
    return false;
};


/**
 * @name MarkerClustererOptions
 * @class This class represents the optional parameter passed to
 *  the {@link MarkerClusterer} constructor.
 * @property {number} [gridSize=60] The grid size of a cluster in pixels. The grid is a square.
 * @property {number} [maxZoom=null] The maximum zoom level at which clustering is enabled or
 *  <code>null</code> if clustering is to be enabled at all zoom levels.
 * @property {boolean} [zoomOnClick=true] Whether to zoom the map when a cluster marker is
 *  clicked. You may want to set this to <code>false</code> if you have installed a handler
 *  for the <code>click</code> event and it deals with zooming on its own.
 * @property {boolean} [averageCenter=false] Whether the position of a cluster marker should be
 *  the average position of all markers in the cluster. If set to <code>false</code>, the
 *  cluster marker is positioned at the location of the first marker added to the cluster.
 * @property {number} [minimumClusterSize=2] The minimum number of markers needed in a cluster
 *  before the markers are hidden and a cluster marker appears.
 * @property {boolean} [ignoreHidden=false] Whether to ignore hidden markers in clusters. You
 *  may want to set this to <code>true</code> to ensure that hidden markers are not included
 *  in the marker count that appears on a cluster marker (this count is the value of the
 *  <code>text</code> property of the result returned by the default <code>calculator</code>).
 *  If set to <code>true</code> and you change the visibility of a marker being clustered, be
 *  sure to also call <code>MarkerClusterer.repaint()</code>.
 * @property {boolean} [printable=false] Whether to make the cluster icons printable. Do not
 *  set to <code>true</code> if the <code>url</code> fields in the <code>styles</code> array
 *  refer to image sprite files.
 * @property {string} [title=""] The tooltip to display when the mouse moves over a cluster
 *  marker. (Alternatively, you can use a custom <code>calculator</code> function to specify a
 *  different tooltip for each cluster marker.)
 * @property {function} [calculator=MarkerClusterer.CALCULATOR] The function used to determine
 *  the text to be displayed on a cluster marker and the index indicating which style to use
 *  for the cluster marker. The input parameters for the function are (1) the array of markers
 *  represented by a cluster marker and (2) the number of cluster icon styles. It returns a
 *  {@link ClusterIconInfo} object. The default <code>calculator</code> returns a
 *  <code>text</code> property which is the number of markers in the cluster and an
 *  <code>index</code> property which is one higher than the lowest integer such that
 *  <code>10^i</code> exceeds the number of markers in the cluster, or the size of the styles
 *  array, whichever is less. The <code>styles</code> array element used has an index of
 *  <code>index</code> minus 1. For example, the default <code>calculator</code> returns a
 *  <code>text</code> value of <code>"125"</code> and an <code>index</code> of <code>3</code>
 *  for a cluster icon representing 125 markers so the element used in the <code>styles</code>
 *  array is <code>2</code>. A <code>calculator</code> may also return a <code>title</code>
 *  property that contains the text of the tooltip to be used for the cluster marker. If
 *   <code>title</code> is not defined, the tooltip is set to the value of the <code>title</code>
 *   property for the MarkerClusterer.
 * @property {string} [clusterClass="cluster"] The name of the CSS class defining general styles
 *  for the cluster markers. Use this class to define CSS styles that are not set up by the code
 *  that processes the <code>styles</code> array.
 * @property {Array} [styles] An array of {@link ClusterIconStyle} elements defining the styles
 *  of the cluster markers to be used. The element to be used to style a given cluster marker
 *  is determined by the function defined by the <code>calculator</code> property.
 *  The default is an array of {@link ClusterIconStyle} elements whose properties are derived
 *  from the values for <code>imagePath</code>, <code>imageExtension</code>, and
 *  <code>imageSizes</code>.
 * @property {number} [batchSize=MarkerClusterer.BATCH_SIZE] Set this property to the
 *  number of markers to be processed in a single batch when using a browser other than
 *  Internet Explorer (for Internet Explorer, use the batchSizeIE property instead).
 * @property {number} [batchSizeIE=MarkerClusterer.BATCH_SIZE_IE] When Internet Explorer is
 *  being used, markers are processed in several batches with a small delay inserted between
 *  each batch in an attempt to avoid Javascript timeout errors. Set this property to the
 *  number of markers to be processed in a single batch; select as high a number as you can
 *  without causing a timeout error in the browser. This number might need to be as low as 100
 *  if 15,000 markers are being managed, for example.
 * @property {string} [imagePath=MarkerClusterer.IMAGE_PATH]
 *  The full URL of the root name of the group of image files to use for cluster icons.
 *  The complete file name is of the form <code>imagePath</code>n.<code>imageExtension</code>
 *  where n is the image file number (1, 2, etc.).
 * @property {string} [imageExtension=MarkerClusterer.IMAGE_EXTENSION]
 *  The extension name for the cluster icon image files (e.g., <code>"png"</code> or
 *  <code>"jpg"</code>).
 * @property {Array} [imageSizes=MarkerClusterer.IMAGE_SIZES]
 *  An array of numbers containing the widths of the group of
 *  <code>imagePath</code>n.<code>imageExtension</code> image files.
 *  (The images are assumed to be square.)
 */
/**
 * Creates a MarkerClusterer object with the options specified in {@link MarkerClustererOptions}.
 * @constructor
 * @extends google.maps.OverlayView
 * @param {google.maps.Map} map The Google map to attach to.
 * @param {Array.<google.maps.Marker>} [opt_markers] The markers to be added to the cluster.
 * @param {MarkerClustererOptions} [opt_options] The optional parameters.
 */
function MarkerClusterer(map, opt_markers, opt_options) {
    // MarkerClusterer implements google.maps.OverlayView interface. We use the
    // extend function to extend MarkerClusterer with google.maps.OverlayView
    // because it might not always be available when the code is defined so we
    // look for it at the last possible moment. If it doesn't exist now then
    // there is no point going ahead :)
    this.extend(MarkerClusterer, google.maps.OverlayView);

    opt_markers = opt_markers || [];
    opt_options = opt_options || {};

    this.markers_ = [];
    this.clusters_ = [];
    this.listeners_ = [];
    this.activeMap_ = null;
    this.ready_ = false;

    this.gridSize_ = opt_options.gridSize || 60;
    this.minClusterSize_ = opt_options.minimumClusterSize || 2;
    this.maxZoom_ = opt_options.maxZoom || null;
    this.styles_ = opt_options.styles || [];
    this.title_ = opt_options.title || "";
    this.zoomOnClick_ = true;
    if (opt_options.zoomOnClick !== undefined) {
        this.zoomOnClick_ = opt_options.zoomOnClick;
    }
    this.averageCenter_ = false;
    if (opt_options.averageCenter !== undefined) {
        this.averageCenter_ = opt_options.averageCenter;
    }
    this.ignoreHidden_ = false;
    if (opt_options.ignoreHidden !== undefined) {
        this.ignoreHidden_ = opt_options.ignoreHidden;
    }
    this.printable_ = false;
    if (opt_options.printable !== undefined) {
        this.printable_ = opt_options.printable;
    }
    this.imagePath_ = opt_options.imagePath || MarkerClusterer.IMAGE_PATH;
    this.imageExtension_ = opt_options.imageExtension || MarkerClusterer.IMAGE_EXTENSION;
    this.imageSizes_ = opt_options.imageSizes || MarkerClusterer.IMAGE_SIZES;
    this.calculator_ = opt_options.calculator || MarkerClusterer.CALCULATOR;
    this.batchSize_ = opt_options.batchSize || MarkerClusterer.BATCH_SIZE;
    this.batchSizeIE_ = opt_options.batchSizeIE || MarkerClusterer.BATCH_SIZE_IE;
    this.clusterClass_ = opt_options.clusterClass || "cluster";

    if (navigator.userAgent.toLowerCase().indexOf("msie") !== -1) {
        // Try to avoid IE timeout when processing a huge number of markers:
        this.batchSize_ = this.batchSizeIE_;
    }

    this.setupStyles_();

    this.addMarkers(opt_markers, true);
    this.setMap(map); // Note: this causes onAdd to be called
}


/**
 * Implementation of the onAdd interface method.
 * @ignore
 */
MarkerClusterer.prototype.onAdd = function () {
    var cMarkerClusterer = this;

    this.activeMap_ = this.getMap();
    this.ready_ = true;

    this.repaint();

    // Add the map event listeners
    this.listeners_ = [
        google.maps.event.addListener(this.getMap(), "zoom_changed", function () {
            cMarkerClusterer.resetViewport_(false);
            // Workaround for this Google bug: when map is at level 0 and "-" of
            // zoom slider is clicked, a "zoom_changed" event is fired even though
            // the map doesn't zoom out any further. In this situation, no "idle"
            // event is triggered so the cluster markers that have been removed
            // do not get redrawn. Same goes for a zoom in at maxZoom.
            if (this.getZoom() === (this.get("minZoom") || 0) || this.getZoom() === this.get("maxZoom")) {
                google.maps.event.trigger(this, "idle");
            }
        }),
        google.maps.event.addListener(this.getMap(), "idle", function () {
            cMarkerClusterer.redraw_();
        })
    ];
};


/**
 * Implementation of the onRemove interface method.
 * Removes map event listeners and all cluster icons from the DOM.
 * All managed markers are also put back on the map.
 * @ignore
 */
MarkerClusterer.prototype.onRemove = function () {
    var i;

    // Put all the managed markers back on the map:
    for (i = 0; i < this.markers_.length; i++) {
        if (this.markers_[i].getMap() !== this.activeMap_) {
            this.markers_[i].setMap(this.activeMap_);
        }
    }

    // Remove all clusters:
    for (i = 0; i < this.clusters_.length; i++) {
        this.clusters_[i].remove();
    }
    this.clusters_ = [];

    // Remove map event listeners:
    for (i = 0; i < this.listeners_.length; i++) {
        google.maps.event.removeListener(this.listeners_[i]);
    }
    this.listeners_ = [];

    this.activeMap_ = null;
    this.ready_ = false;
};


/**
 * Implementation of the draw interface method.
 * @ignore
 */
MarkerClusterer.prototype.draw = function () {};


/**
 * Sets up the styles object.
 */
MarkerClusterer.prototype.setupStyles_ = function () {
    var i, size;
    if (this.styles_.length > 0) {
        return;
    }

    for (i = 0; i < this.imageSizes_.length; i++) {
        size = this.imageSizes_[i];
        this.styles_.push({
            url: this.imagePath_ + (i + 1) + "." + this.imageExtension_,
            height: size,
            width: size
        });
    }
};


/**
 *  Fits the map to the bounds of the markers managed by the clusterer.
 */
MarkerClusterer.prototype.fitMapToMarkers = function () {
    var i;
    var markers = this.getMarkers();
    var bounds = new google.maps.LatLngBounds();
    for (i = 0; i < markers.length; i++) {
        bounds.extend(markers[i].getPosition());
    }

    this.getMap().fitBounds(bounds);
};


/**
 * Returns the value of the <code>gridSize</code> property.
 *
 * @return {number} The grid size.
 */
MarkerClusterer.prototype.getGridSize = function () {
    return this.gridSize_;
};


/**
 * Sets the value of the <code>gridSize</code> property.
 *
 * @param {number} gridSize The grid size.
 */
MarkerClusterer.prototype.setGridSize = function (gridSize) {
    this.gridSize_ = gridSize;
};


/**
 * Returns the value of the <code>minimumClusterSize</code> property.
 *
 * @return {number} The minimum cluster size.
 */
MarkerClusterer.prototype.getMinimumClusterSize = function () {
    return this.minClusterSize_;
};

/**
 * Sets the value of the <code>minimumClusterSize</code> property.
 *
 * @param {number} minimumClusterSize The minimum cluster size.
 */
MarkerClusterer.prototype.setMinimumClusterSize = function (minimumClusterSize) {
    this.minClusterSize_ = minimumClusterSize;
};


/**
 *  Returns the value of the <code>maxZoom</code> property.
 *
 *  @return {number} The maximum zoom level.
 */
MarkerClusterer.prototype.getMaxZoom = function () {
    return this.maxZoom_;
};


/**
 *  Sets the value of the <code>maxZoom</code> property.
 *
 *  @param {number} maxZoom The maximum zoom level.
 */
MarkerClusterer.prototype.setMaxZoom = function (maxZoom) {
    this.maxZoom_ = maxZoom;
};


/**
 *  Returns the value of the <code>styles</code> property.
 *
 *  @return {Array} The array of styles defining the cluster markers to be used.
 */
MarkerClusterer.prototype.getStyles = function () {
    return this.styles_;
};


/**
 *  Sets the value of the <code>styles</code> property.
 *
 *  @param {Array.<ClusterIconStyle>} styles The array of styles to use.
 */
MarkerClusterer.prototype.setStyles = function (styles) {
    this.styles_ = styles;
};


/**
 * Returns the value of the <code>title</code> property.
 *
 * @return {string} The content of the title text.
 */
MarkerClusterer.prototype.getTitle = function () {
    return this.title_;
};


/**
 *  Sets the value of the <code>title</code> property.
 *
 *  @param {string} title The value of the title property.
 */
MarkerClusterer.prototype.setTitle = function (title) {
    this.title_ = title;
};


/**
 * Returns the value of the <code>zoomOnClick</code> property.
 *
 * @return {boolean} True if zoomOnClick property is set.
 */
MarkerClusterer.prototype.getZoomOnClick = function () {
    return this.zoomOnClick_;
};


/**
 *  Sets the value of the <code>zoomOnClick</code> property.
 *
 *  @param {boolean} zoomOnClick The value of the zoomOnClick property.
 */
MarkerClusterer.prototype.setZoomOnClick = function (zoomOnClick) {
    this.zoomOnClick_ = zoomOnClick;
};


/**
 * Returns the value of the <code>averageCenter</code> property.
 *
 * @return {boolean} True if averageCenter property is set.
 */
MarkerClusterer.prototype.getAverageCenter = function () {
    return this.averageCenter_;
};


/**
 *  Sets the value of the <code>averageCenter</code> property.
 *
 *  @param {boolean} averageCenter The value of the averageCenter property.
 */
MarkerClusterer.prototype.setAverageCenter = function (averageCenter) {
    this.averageCenter_ = averageCenter;
};


/**
 * Returns the value of the <code>ignoreHidden</code> property.
 *
 * @return {boolean} True if ignoreHidden property is set.
 */
MarkerClusterer.prototype.getIgnoreHidden = function () {
    return this.ignoreHidden_;
};


/**
 *  Sets the value of the <code>ignoreHidden</code> property.
 *
 *  @param {boolean} ignoreHidden The value of the ignoreHidden property.
 */
MarkerClusterer.prototype.setIgnoreHidden = function (ignoreHidden) {
    this.ignoreHidden_ = ignoreHidden;
};


/**
 * Returns the value of the <code>imageExtension</code> property.
 *
 * @return {string} The value of the imageExtension property.
 */
MarkerClusterer.prototype.getImageExtension = function () {
    return this.imageExtension_;
};


/**
 *  Sets the value of the <code>imageExtension</code> property.
 *
 *  @param {string} imageExtension The value of the imageExtension property.
 */
MarkerClusterer.prototype.setImageExtension = function (imageExtension) {
    this.imageExtension_ = imageExtension;
};


/**
 * Returns the value of the <code>imagePath</code> property.
 *
 * @return {string} The value of the imagePath property.
 */
MarkerClusterer.prototype.getImagePath = function () {
    return this.imagePath_;
};


/**
 *  Sets the value of the <code>imagePath</code> property.
 *
 *  @param {string} imagePath The value of the imagePath property.
 */
MarkerClusterer.prototype.setImagePath = function (imagePath) {
    this.imagePath_ = imagePath;
};


/**
 * Returns the value of the <code>imageSizes</code> property.
 *
 * @return {Array} The value of the imageSizes property.
 */
MarkerClusterer.prototype.getImageSizes = function () {
    return this.imageSizes_;
};


/**
 *  Sets the value of the <code>imageSizes</code> property.
 *
 *  @param {Array} imageSizes The value of the imageSizes property.
 */
MarkerClusterer.prototype.setImageSizes = function (imageSizes) {
    this.imageSizes_ = imageSizes;
};


/**
 * Returns the value of the <code>calculator</code> property.
 *
 * @return {function} the value of the calculator property.
 */
MarkerClusterer.prototype.getCalculator = function () {
    return this.calculator_;
};


/**
 * Sets the value of the <code>calculator</code> property.
 *
 * @param {function(Array.<google.maps.Marker>, number)} calculator The value
 *  of the calculator property.
 */
MarkerClusterer.prototype.setCalculator = function (calculator) {
    this.calculator_ = calculator;
};


/**
 * Returns the value of the <code>printable</code> property.
 *
 * @return {boolean} the value of the printable property.
 */
MarkerClusterer.prototype.getPrintable = function () {
    return this.printable_;
};


/**
 * Sets the value of the <code>printable</code> property.
 *
 *  @param {boolean} printable The value of the printable property.
 */
MarkerClusterer.prototype.setPrintable = function (printable) {
    this.printable_ = printable;
};


/**
 * Returns the value of the <code>batchSizeIE</code> property.
 *
 * @return {number} the value of the batchSizeIE property.
 */
MarkerClusterer.prototype.getBatchSizeIE = function () {
    return this.batchSizeIE_;
};


/**
 * Sets the value of the <code>batchSizeIE</code> property.
 *
 *  @param {number} batchSizeIE The value of the batchSizeIE property.
 */
MarkerClusterer.prototype.setBatchSizeIE = function (batchSizeIE) {
    this.batchSizeIE_ = batchSizeIE;
};


/**
 * Returns the value of the <code>clusterClass</code> property.
 *
 * @return {string} the value of the clusterClass property.
 */
MarkerClusterer.prototype.getClusterClass = function () {
    return this.clusterClass_;
};


/**
 * Sets the value of the <code>clusterClass</code> property.
 *
 *  @param {string} clusterClass The value of the clusterClass property.
 */
MarkerClusterer.prototype.setClusterClass = function (clusterClass) {
    this.clusterClass_ = clusterClass;
};


/**
 *  Returns the array of markers managed by the clusterer.
 *
 *  @return {Array} The array of markers managed by the clusterer.
 */
MarkerClusterer.prototype.getMarkers = function () {
    return this.markers_;
};


/**
 *  Returns the number of markers managed by the clusterer.
 *
 *  @return {number} The number of markers.
 */
MarkerClusterer.prototype.getTotalMarkers = function () {
    return this.markers_.length;
};


/**
 * Returns the current array of clusters formed by the clusterer.
 *
 * @return {Array} The array of clusters formed by the clusterer.
 */
MarkerClusterer.prototype.getClusters = function () {
    return this.clusters_;
};


/**
 * Returns the number of clusters formed by the clusterer.
 *
 * @return {number} The number of clusters formed by the clusterer.
 */
MarkerClusterer.prototype.getTotalClusters = function () {
    return this.clusters_.length;
};


/**
 * Adds a marker to the clusterer. The clusters are redrawn unless
 *  <code>opt_nodraw</code> is set to <code>true</code>.
 *
 * @param {google.maps.Marker} marker The marker to add.
 * @param {boolean} [opt_nodraw] Set to <code>true</code> to prevent redrawing.
 */
MarkerClusterer.prototype.addMarker = function (marker, opt_nodraw) {
    this.pushMarkerTo_(marker);
    if (!opt_nodraw) {
        this.redraw_();
    }
};


/**
 * Adds an array of markers to the clusterer. The clusters are redrawn unless
 *  <code>opt_nodraw</code> is set to <code>true</code>.
 *
 * @param {Array.<google.maps.Marker>} markers The markers to add.
 * @param {boolean} [opt_nodraw] Set to <code>true</code> to prevent redrawing.
 */
MarkerClusterer.prototype.addMarkers = function (markers, opt_nodraw) {
    var i;
    for (i = 0; i < markers.length; i++) {
        this.pushMarkerTo_(markers[i]);
    }
    if (!opt_nodraw) {
        this.redraw_();
    }
};


/**
 * Pushes a marker to the clusterer.
 *
 * @param {google.maps.Marker} marker The marker to add.
 */
MarkerClusterer.prototype.pushMarkerTo_ = function (marker) {
    // If the marker is draggable add a listener so we can update the clusters on the dragend:
    if (marker.getDraggable()) {
        var cMarkerClusterer = this;
        google.maps.event.addListener(marker, "dragend", function () {
            if (cMarkerClusterer.ready_) {
                this.isAdded = false;
                cMarkerClusterer.repaint();
            }
        });
    }
    marker.isAdded = false;
    this.markers_.push(marker);
};


/**
 * Removes a marker from the cluster.  The clusters are redrawn unless
 *  <code>opt_nodraw</code> is set to <code>true</code>. Returns <code>true</code> if the
 *  marker was removed from the clusterer.
 *
 * @param {google.maps.Marker} marker The marker to remove.
 * @param {boolean} [opt_nodraw] Set to <code>true</code> to prevent redrawing.
 * @return {boolean} True if the marker was removed from the clusterer.
 */
MarkerClusterer.prototype.removeMarker = function (marker, opt_nodraw) {
    var removed = this.removeMarker_(marker);

    if (!opt_nodraw && removed) {
        this.repaint();
    }

    return removed;
};


/**
 * Removes an array of markers from the cluster. The clusters are redrawn unless
 *  <code>opt_nodraw</code> is set to <code>true</code>. Returns <code>true</code> if markers
 *  were removed from the clusterer.
 *
 * @param {Array.<google.maps.Marker>} markers The markers to remove.
 * @param {boolean} [opt_nodraw] Set to <code>true</code> to prevent redrawing.
 * @return {boolean} True if markers were removed from the clusterer.
 */
MarkerClusterer.prototype.removeMarkers = function (markers, opt_nodraw) {
    var i, r;
    var removed = false;

    for (i = 0; i < markers.length; i++) {
        r = this.removeMarker_(markers[i]);
        removed = removed || r;
    }

    if (!opt_nodraw && removed) {
        this.repaint();
    }

    return removed;
};


/**
 * Removes a marker and returns true if removed, false if not.
 *
 * @param {google.maps.Marker} marker The marker to remove
 * @return {boolean} Whether the marker was removed or not
 */
MarkerClusterer.prototype.removeMarker_ = function (marker) {
    var i;
    var index = -1;
    if (this.markers_.indexOf) {
        index = this.markers_.indexOf(marker);
    } else {
        for (i = 0; i < this.markers_.length; i++) {
            if (marker === this.markers_[i]) {
                index = i;
                break;
            }
        }
    }

    if (index === -1) {
        // Marker is not in our list of markers, so do nothing:
        return false;
    }

    marker.setMap(null);
    this.markers_.splice(index, 1); // Remove the marker from the list of managed markers
    return true;
};


/**
 * Removes all clusters and markers from the map and also removes all markers
 *  managed by the clusterer.
 */
MarkerClusterer.prototype.clearMarkers = function () {
    this.resetViewport_(true);
    this.markers_ = [];
};


/**
 * Recalculates and redraws all the marker clusters from scratch.
 *  Call this after changing any properties.
 */
MarkerClusterer.prototype.repaint = function () {
    var oldClusters = this.clusters_.slice();
    this.clusters_ = [];
    this.resetViewport_(false);
    this.redraw_();

    // Remove the old clusters.
    // Do it in a timeout to prevent blinking effect.
    setTimeout(function () {
        var i;
        for (i = 0; i < oldClusters.length; i++) {
            oldClusters[i].remove();
        }
    }, 0);
};


/**
 * Returns the current bounds extended by the grid size.
 *
 * @param {google.maps.LatLngBounds} bounds The bounds to extend.
 * @return {google.maps.LatLngBounds} The extended bounds.
 * @ignore
 */
MarkerClusterer.prototype.getExtendedBounds = function (bounds) {
    var projection = this.getProjection();

    // Turn the bounds into latlng.
    var tr = new google.maps.LatLng(bounds.getNorthEast().lat(),
        bounds.getNorthEast().lng());
    var bl = new google.maps.LatLng(bounds.getSouthWest().lat(),
        bounds.getSouthWest().lng());

    // Convert the points to pixels and the extend out by the grid size.
    var trPix = projection.fromLatLngToDivPixel(tr);
    trPix.x += this.gridSize_;
    trPix.y -= this.gridSize_;

    var blPix = projection.fromLatLngToDivPixel(bl);
    blPix.x -= this.gridSize_;
    blPix.y += this.gridSize_;

    // Convert the pixel points back to LatLng
    var ne = projection.fromDivPixelToLatLng(trPix);
    var sw = projection.fromDivPixelToLatLng(blPix);

    // Extend the bounds to contain the new bounds.
    bounds.extend(ne);
    bounds.extend(sw);

    return bounds;
};


/**
 * Redraws all the clusters.
 */
MarkerClusterer.prototype.redraw_ = function () {
    this.createClusters_(0);
};


/**
 * Removes all clusters from the map. The markers are also removed from the map
 *  if <code>opt_hide</code> is set to <code>true</code>.
 *
 * @param {boolean} [opt_hide] Set to <code>true</code> to also remove the markers
 *  from the map.
 */
MarkerClusterer.prototype.resetViewport_ = function (opt_hide) {
    var i, marker;
    // Remove all the clusters
    for (i = 0; i < this.clusters_.length; i++) {
        this.clusters_[i].remove();
    }
    this.clusters_ = [];

    // Reset the markers to not be added and to be removed from the map.
    for (i = 0; i < this.markers_.length; i++) {
        marker = this.markers_[i];
        marker.isAdded = false;
        if (opt_hide) {
            marker.setMap(null);
        }
    }
};


/**
 * Calculates the distance between two latlng locations in km.
 *
 * @param {google.maps.LatLng} p1 The first lat lng point.
 * @param {google.maps.LatLng} p2 The second lat lng point.
 * @return {number} The distance between the two points in km.
 * @see http://www.movable-type.co.uk/scripts/latlong.html
 */
MarkerClusterer.prototype.distanceBetweenPoints_ = function (p1, p2) {
    var R = 6371; // Radius of the Earth in km
    var dLat = (p2.lat() - p1.lat()) * Math.PI / 180;
    var dLon = (p2.lng() - p1.lng()) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat() * Math.PI / 180) * Math.cos(p2.lat() * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
};


/**
 * Determines if a marker is contained in a bounds.
 *
 * @param {google.maps.Marker} marker The marker to check.
 * @param {google.maps.LatLngBounds} bounds The bounds to check against.
 * @return {boolean} True if the marker is in the bounds.
 */
MarkerClusterer.prototype.isMarkerInBounds_ = function (marker, bounds) {
    return bounds.contains(marker.getPosition());
};


/**
 * Adds a marker to a cluster, or creates a new cluster.
 *
 * @param {google.maps.Marker} marker The marker to add.
 */
MarkerClusterer.prototype.addToClosestCluster_ = function (marker) {
    var i, d, cluster, center;
    var distance = 40000; // Some large number
    var clusterToAddTo = null;
    for (i = 0; i < this.clusters_.length; i++) {
        cluster = this.clusters_[i];
        center = cluster.getCenter();
        if (center) {
            d = this.distanceBetweenPoints_(center, marker.getPosition());
            if (d < distance) {
                distance = d;
                clusterToAddTo = cluster;
            }
        }
    }

    if (clusterToAddTo && clusterToAddTo.isMarkerInClusterBounds(marker)) {
        clusterToAddTo.addMarker(marker);
    } else {

        cluster = new Cluster(this);
        cluster.addMarker(marker);
        this.clusters_.push(cluster);
    }
};


/**
 * Creates the clusters. This is done in batches to avoid timeout errors
 *  in some browsers when there is a huge number of markers.
 *
 * @param {number} iFirst The index of the first marker in the batch of
 *  markers to be added to clusters.
 */
MarkerClusterer.prototype.createClusters_ = function (iFirst) {
    var i, marker;
    var mapBounds;
    var cMarkerClusterer = this;
    if (!this.ready_) {
        return;
    }

    // Cancel previous batch processing if we're working on the first batch:
    if (iFirst === 0) {
        /**
         * This event is fired when the <code>MarkerClusterer</code> begins
         *  clustering markers.
         * @name MarkerClusterer#clusteringbegin
         * @param {MarkerClusterer} mc The MarkerClusterer whose markers are being clustered.
         * @event
         */
        google.maps.event.trigger(this, "clusteringbegin", this);

        if (typeof this.timerRefStatic !== "undefined") {
            clearTimeout(this.timerRefStatic);
            delete this.timerRefStatic;
        }
    }

    // Get our current map view bounds.
    // Create a new bounds object so we don't affect the map.
    //
    // See Comments 9 & 11 on Issue 3651 relating to this workaround for a Google Maps bug:
    if (this.getMap().getZoom() > 3) {
        mapBounds = new google.maps.LatLngBounds(this.getMap().getBounds().getSouthWest(),
            this.getMap().getBounds().getNorthEast());
    } else {
        mapBounds = new google.maps.LatLngBounds(new google.maps.LatLng(85.02070771743472, -178.48388434375), new google.maps.LatLng(-85.08136444384544, 178.00048865625));
    }
    var bounds = this.getExtendedBounds(mapBounds);

    var iLast = Math.min(iFirst + this.batchSize_, this.markers_.length);

    for (i = iFirst; i < iLast; i++) {
        marker = this.markers_[i];
        if (!marker.isAdded && this.isMarkerInBounds_(marker, bounds)) {
            if (!this.ignoreHidden_ || (this.ignoreHidden_ && marker.getVisible())) {
                this.addToClosestCluster_(marker);
            }
        }
    }

    if (iLast < this.markers_.length) {
        this.timerRefStatic = setTimeout(function () {
            cMarkerClusterer.createClusters_(iLast);
        }, 0);
    } else {
        delete this.timerRefStatic;

        /**
         * This event is fired when the <code>MarkerClusterer</code> stops
         *  clustering markers.
         * @name MarkerClusterer#clusteringend
         * @param {MarkerClusterer} mc The MarkerClusterer whose markers are being clustered.
         * @event
         */
        google.maps.event.trigger(this, "clusteringend", this);
    }
};


/**
 * Extends an object's prototype by another's.
 *
 * @param {Object} obj1 The object to be extended.
 * @param {Object} obj2 The object to extend with.
 * @return {Object} The new extended object.
 * @ignore
 */
MarkerClusterer.prototype.extend = function (obj1, obj2) {
    return (function (object) {
        var property;
        for (property in object.prototype) {
            this.prototype[property] = object.prototype[property];
        }
        return this;
    }).apply(obj1, [obj2]);
};


/**
 * The default function for determining the label text and style
 * for a cluster icon.
 *
 * @param {Array.<google.maps.Marker>} markers The array of markers represented by the cluster.
 * @param {number} numStyles The number of marker styles available.
 * @return {ClusterIconInfo} The information resource for the cluster.
 * @constant
 * @ignore
 */
MarkerClusterer.CALCULATOR = function (markers, numStyles) {
    var index = 0;
    var title = "";
    var count = markers.length.toString();

    var dv = count;
    while (dv !== 0) {
        dv = parseInt(dv / 10, 10);
        index++;
    }

    index = Math.min(index, numStyles);
    return {
        text: count,
        index: index,
        title: title
    };
};


/**
 * The number of markers to process in one batch.
 *
 * @type {number}
 * @constant
 */
MarkerClusterer.BATCH_SIZE = 2000;


/**
 * The number of markers to process in one batch (IE only).
 *
 * @type {number}
 * @constant
 */
MarkerClusterer.BATCH_SIZE_IE = 500;


/**
 * The default root name for the marker cluster images.
 *
 * @type {string}
 * @constant
 */
MarkerClusterer.IMAGE_PATH = "http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclustererplus/images/m";


/**
 * The default extension name for the marker cluster images.
 *
 * @type {string}
 * @constant
 */
MarkerClusterer.IMAGE_EXTENSION = "png";


/**
 * The default array of sizes for the marker cluster images.
 *
 * @type {Array.<number>}
 * @constant
 */
MarkerClusterer.IMAGE_SIZES = [53, 56, 66, 78, 90];;
(function ($) {

$(document).ready(function() {

  // Expression to check for absolute internal links.
  var isInternal = new RegExp("^(https?):\/\/" + window.location.host, "i");

  // Attach onclick event to document only and catch clicks on all elements.
  $(document.body).click(function(event) {
    // Catch the closest surrounding link of a clicked element.
    $(event.target).closest("a,area").each(function() {

      var ga = Drupal.settings.googleanalytics;
      // Expression to check for special links like gotwo.module /go/* links.
      var isInternalSpecial = new RegExp("(\/go\/.*)$", "i");
      // Expression to check for download links.
      var isDownload = new RegExp("\\.(" + ga.trackDownloadExtensions + ")$", "i");

      // Is the clicked URL internal?
      if (isInternal.test(this.href)) {
        // Skip 'click' tracking, if custom tracking events are bound.
        if ($(this).is('.colorbox')) {
          // Do nothing here. The custom event will handle all tracking.
        }
        // Is download tracking activated and the file extension configured for download tracking?
        else if (ga.trackDownload && isDownload.test(this.href)) {
          // Download link clicked.
          var extension = isDownload.exec(this.href);
          _gaq.push(["_trackEvent", "Downloads", extension[1].toUpperCase(), this.href.replace(isInternal, '')]);
        }
        else if (isInternalSpecial.test(this.href)) {
          // Keep the internal URL for Google Analytics website overlay intact.
          _gaq.push(["_trackPageview", this.href.replace(isInternal, '')]);
        }
      }
      else {
        if (ga.trackMailto && $(this).is("a[href^='mailto:'],area[href^='mailto:']")) {
          // Mailto link clicked.
          _gaq.push(["_trackEvent", "Mails", "Click", this.href.substring(7)]);
        }
        else if (ga.trackOutbound && this.href.match(/^\w+:\/\//i)) {
          if (ga.trackDomainMode == 2 && isCrossDomain($(this).attr('hostname'), ga.trackCrossDomains)) {
            // Top-level cross domain clicked. document.location is handled by _link internally.
            event.preventDefault();
            _gaq.push(["_link", this.href]);
          }
          else {
            // External link clicked.
            _gaq.push(["_trackEvent", "Outbound links", "Click", this.href]);
          }
        }
      }
    });
  });

  // Colorbox: This event triggers when the transition has completed and the
  // newly loaded content has been revealed.
  $(document).bind("cbox_complete", function() {
    var href = $.colorbox.element().attr("href");
    if (href) {
      _gaq.push(["_trackPageview", href.replace(isInternal, '')]);
    }
  });

});

/**
 * Check whether the hostname is part of the cross domains or not.
 *
 * @param string hostname
 *   The hostname of the clicked URL.
 * @param array crossDomains
 *   All cross domain hostnames as JS array.
 *
 * @return boolean
 */
function isCrossDomain(hostname, crossDomains) {
  /**
   * jQuery < 1.6.3 bug: $.inArray crushes IE6 and Chrome if second argument is
   * `null` or `undefined`, http://bugs.jquery.com/ticket/10076,
   * https://github.com/jquery/jquery/commit/a839af034db2bd934e4d4fa6758a3fed8de74174
   *
   * @todo: Remove/Refactor in D8
   */
  if (!crossDomains) {
    return false;
  }
  else {
    return $.inArray(hostname, crossDomains) > -1 ? true : false;
  }
}

})(jQuery);
;
