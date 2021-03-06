/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var igv = (function (igv) {

    igv.TrackView = function (track, browser) {

        var self = this,
            element;

        this.track = track;
        this.browser = browser;

        this.trackDiv = $('<div class="igv-track-div">')[0];
        $(browser.trackContainerDiv).append(this.trackDiv);

        // Optionally override CSS height
        if (track.height) {          // Explicit height set, perhaps track.config.height?
            this.trackDiv.style.height = track.height + "px";
        }

        $(this.trackDiv).append(this.createLeftHandGutter());

        this.addViewportToParentTrackDiv(this.trackDiv);

        element = this.createRightHandGutter();
        if (element) {
            $(this.trackDiv).append(element);
        }

        this.trackDiv.appendChild(igv.spinner());

        // Track Drag & Drop
        makeTrackDraggable(this.track);

        if (this.track instanceof igv.RulerTrack) {

            this.trackDiv.dataset.rulerTrack = "rulerTrack";

            // ruler sweeper widget surface
            this.rulerSweeper = $('<div class="igv-ruler-sweeper-div">');
            $(this.contentDiv).append(this.rulerSweeper[0]);

            addRulerTrackHandlers(this);

        } else {
            addTrackHandlers(this);
        }

        function makeTrackDraggable(track) {

            self.igvTrackDragScrim = $('<div class="igv-track-drag-scrim">')[0];
            $(self.viewportDiv).append(self.igvTrackDragScrim);
            $(self.igvTrackDragScrim).hide();

            self.igvTrackManipulationHandle = $('<div class="igv-track-manipulation-handle">')[0];
            $(self.trackDiv).append(self.igvTrackManipulationHandle);

            $(self.igvTrackManipulationHandle).mousedown(function (e) {

                self.isMouseDown = true;
                igv.browser.dragTrackView = self;
            });

            $(self.igvTrackManipulationHandle).mouseup(function (e) {
                self.isMouseDown = undefined;
            });

            $(self.igvTrackManipulationHandle).mouseenter(function (e) {

                self.isMouseIn = true;
                igv.browser.dragTargetTrackView = self;

                if (undefined === igv.browser.dragTrackView) {
                    $(self.igvTrackDragScrim).show();
                } else if (self === igv.browser.dragTrackView) {
                    $(self.igvTrackDragScrim).show();
                }

                if (igv.browser.dragTargetTrackView && igv.browser.dragTrackView) {

                    if (igv.browser.dragTargetTrackView !== igv.browser.dragTrackView) {

                        if (igv.browser.dragTargetTrackView.track.order < igv.browser.dragTrackView.track.order) {

                            igv.browser.dragTrackView.track.order = igv.browser.dragTargetTrackView.track.order;
                            igv.browser.dragTargetTrackView.track.order = 1 + igv.browser.dragTrackView.track.order;
                        } else {

                            igv.browser.dragTrackView.track.order = igv.browser.dragTargetTrackView.track.order;
                            igv.browser.dragTargetTrackView.track.order = igv.browser.dragTrackView.track.order - 1;
                        }

                        igv.browser.reorderTracks();
                    }
                }

            });

            $(self.igvTrackManipulationHandle).mouseleave(function (e) {

                self.isMouseIn = undefined;
                igv.browser.dragTargetTrackView = undefined;

                if (self !== igv.browser.dragTrackView) {
                    $(self.igvTrackDragScrim).hide();
                }

            });

        }
    };

    igv.TrackView.prototype.addViewportToParentTrackDiv = function (trackDiv) {

        var self = this,
            $dataRangeLabel,
            str,
            min,
            max;

        // viewport
        this.viewportDiv = $('<div class="igv-viewport-div igv-gutter-shim">')[0];
        $(trackDiv).append(this.viewportDiv);

        // content  -- purpose of this div is to allow vertical scrolling on individual tracks,
        this.contentDiv = $('<div class="igv-content-div">')[0];
        $(this.viewportDiv).append(this.contentDiv);

        // track content canvas
        this.canvas = $('<canvas class = "igv-content-canvas">')[0];
        $(this.contentDiv).append(this.canvas);
        this.canvas.setAttribute('width', this.contentDiv.clientWidth);
        this.canvas.setAttribute('height', this.contentDiv.clientHeight);
        this.ctx = this.canvas.getContext("2d");

        // zoom in to see features
        if (this.track.visibilityWindow !== undefined) {
            self.$zoomInNotice = $('<div class="zoom-in-notice">');
            self.$zoomInNotice.text('Zoom in to see features');
            $(this.contentDiv).append(self.$zoomInNotice[0]);
            self.$zoomInNotice.hide();
        }

        // scrollbar,  default is to set overflow ot hidden and use custom scrollbar, but this can be overriden so check
        if ("hidden" === $(this.viewportDiv).css("overflow-y")) {
            this.scrollbar = new TrackScrollbar(this.viewportDiv, this.contentDiv);
            this.scrollbar.update();
            $(this.viewportDiv).append(this.scrollbar.outerScrollDiv);
        }

        if (this.track instanceof igv.WIGTrack) {

            $dataRangeLabel = $('<div class="igv-data-range-track-label">');

            $dataRangeLabel.click(function (e) {
                igv.dataRangeDialog.configureWithTrackView(self);
                igv.dataRangeDialog.show();
            });

            $(this.viewportDiv).append($dataRangeLabel[0]);

        }

    };

    igv.TrackView.prototype.createLeftHandGutter = function () {

        var description,
            $appIconContainer;

        this.leftHandGutter = $('<div class="igv-left-hand-gutter">')[0];

        if (this.track.paintAxis) {

            this.controlCanvas = $('<canvas class ="igv-track-control-canvas">')[0];
            this.controlCanvas.setAttribute('width', this.leftHandGutter.clientWidth);
            this.controlCanvas.setAttribute('height', this.leftHandGutter.clientHeight);
            this.controlCtx = this.controlCanvas.getContext("2d");

            $(this.leftHandGutter).append(this.controlCanvas);
        }

        if (this.track.name) {

            $appIconContainer = $('<div class="igv-app-icon-container">');
            $appIconContainer.text(this.track.name);

            description = this.track.description || this.track.name;
            $appIconContainer.click(function (e) {
                igv.popover.presentTrackPopup(e.pageX, e.pageY, description, false);
            });

            $(this.leftHandGutter).append($appIconContainer[0]);
        }

        return this.leftHandGutter;

    };

    igv.TrackView.prototype.createRightHandGutter = function () {

        var self = this,
            gearButton;

        if (this.track.ignoreTrackMenu) {
            return undefined;
        }

        gearButton = $('<i class="fa fa-gear fa-20px igv-track-menu-gear igv-app-icon">');

        $(gearButton).click(function (e) {
            igv.popover.presentTrackMenu(e.pageX, e.pageY, self);
        });

        this.rightHandGutter = $('<div class="igv-right-hand-gutter">')[0];
        $(this.rightHandGutter).append(gearButton[0]);

        return this.rightHandGutter;

    };

    igv.TrackView.prototype.resize = function () {
        var canvas = this.canvas,
            contentDiv = this.contentDiv,
            contentWidth = this.viewportDiv.clientWidth;

        if (contentWidth > 0) {
            contentDiv.style.width = contentWidth + "px";      // Not sure why css is not working for this
            canvas.style.width = contentWidth + "px";
            canvas.setAttribute('width', contentWidth);    //Must set the width & height of the canvas
            this.update();
        }
    };

    igv.TrackView.prototype.setTrackHeight = function (newHeight, update) {

        setTrackHeight_.call(this, newHeight, update || true);

    };

    /**
     * Set the content height of the track
     *
     * @param newHeight
     * @param update
     */
    igv.TrackView.prototype.setContentHeight = function (newHeight) {

        var contentHeightStr = newHeight + "px";

        // Optionally adjust the trackDiv and viewport height to fit the content height, within min/max bounds
        if (this.track.autoHeight) {
            setTrackHeight_.call(this, newHeight, false);
        }

        this.contentDiv.style.height = contentHeightStr;
        this.canvas.setAttribute("height", this.canvas.clientHeight);
        if (this.track.paintAxis) {
            this.controlCanvas.style.height = contentHeightStr;
            this.controlCanvas.setAttribute("height", newHeight);
        }

        if (this.scrollbar) this.scrollbar.update();
    };

    function setTrackHeight_(newHeight, update) {

        var trackHeightStr;

        if (this.track.minHeight) newHeight = Math.max(this.track.minHeight, newHeight);
        if (this.track.maxHeight) newHeight = Math.min(this.track.maxHeight, newHeight);
        // if (newHeight === this.track.height) return;   // Nothing to do

        trackHeightStr = newHeight + "px";

        this.track.height = newHeight;    // Recorded on track for use when saving sessions

        this.trackDiv.style.height = trackHeightStr;

        if (this.track.paintAxis) {
            this.controlCanvas.style.height = trackHeightStr;
            this.controlCanvas.setAttribute("height", newHeight);
        }

        this.viewportDiv.style.height = trackHeightStr;


        if (update === undefined || update === true) {
            this.update();
        }

    }

    igv.TrackView.prototype.update = function () {

        this.tile = null;
        if (this.scrollbar) this.scrollbar.update();
        this.repaint();

    };

    /**
     * Repaint the view, using a cached image if available.  If no image covering the view is available a new one
     * is created, delegating the draw details to the track object.
     */
    igv.TrackView.prototype.repaint = function () {


        var pixelWidth,
            bpWidth,
            bpStart,
            bpEnd,
            self = this,
            ctx,
            referenceFrame,
            chr,
            refFrameStart,
            refFrameEnd,
            success;

        if (!(viewIsReady.call(this))) {
            return;
        }

        if (this.track.visibilityWindow !== undefined) {
            if (igv.browser.trackViewportWidthBP() > this.track.visibilityWindow) {
                this.tile = null;
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                igv.stopSpinnerAtParentElement(this.trackDiv);      // TODO -  WHY DO WE HAVE TO DO THIS ???
                this.$zoomInNotice.show();
                return;
            } else {
                this.$zoomInNotice.hide();
            }
        }

        referenceFrame = this.browser.referenceFrame;
        chr = referenceFrame.chr;
        refFrameStart = referenceFrame.start;
        refFrameEnd = refFrameStart + referenceFrame.toBP(this.canvas.width);

        if (this.tile && this.tile.containsRange(chr, refFrameStart, refFrameEnd, referenceFrame.bpPerPixel)) {
            this.paintImage();
        }
        else {

            // Expand the requested range so we can pan a bit without reloading
            pixelWidth = 3 * this.canvas.width;
            bpWidth = Math.round(referenceFrame.toBP(pixelWidth));
            bpStart = Math.max(0, Math.round(referenceFrame.start - bpWidth / 3));
            bpEnd = bpStart + bpWidth;

            if(self.loading && self.loading.start === bpStart && self.loading.end === bpEnd) return;

            self.loading = {start: bpStart, end: bpEnd};

            igv.startSpinnerAtParentElement(self.trackDiv);

            this.track.getFeatures(referenceFrame.chr, bpStart, bpEnd)

                .then(function (features) {

                    self.loading = false;
                    igv.stopSpinnerAtParentElement(self.trackDiv);

                    if (features) {

                        // TODO -- adjust track height here.
                        if (typeof self.track.computePixelHeight === 'function') {
                            var requiredHeight = self.track.computePixelHeight(features);
                            if (requiredHeight != self.contentDiv.clientHeight) {
                                self.setContentHeight(requiredHeight);
                            }
                        }
                        var buffer = document.createElement('canvas');
                        buffer.width = pixelWidth;
                        buffer.height = self.canvas.height;
                        ctx = buffer.getContext('2d');

                        self.track.draw({
                            features: features,
                            context: ctx,
                            bpStart: bpStart,
                            bpPerPixel: referenceFrame.bpPerPixel,
                            pixelWidth: buffer.width,
                            pixelHeight: buffer.height
                        });

                        if (self.track.paintAxis) {

                            var buffer2 = document.createElement('canvas');
                            buffer2.width = self.controlCanvas.width;
                            buffer2.height = self.controlCanvas.height;

                            var ctx2 = buffer2.getContext('2d');

                            self.track.paintAxis(ctx2, buffer2.width, buffer2.height);

                            self.controlCtx.drawImage(buffer2, 0, 0);
                        }

                        self.tile = new Tile(referenceFrame.chr, bpStart, bpEnd, referenceFrame.bpPerPixel, buffer);
                        self.paintImage();
                    }
                    else {
                        self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
                    }

                })
                .catch(function (error) {
                    self.loading = false;

                    if (error instanceof igv.AbortLoad) {
                        console.log("Aborted ---");
                    }
                    else {
                        igv.stopSpinnerAtParentElement(self.trackDiv);
                        console.log(error);
                        igv.presentAlert(error);
                    }
                });
        }


        function viewIsReady() {
            return this.track && this.browser && this.browser.referenceFrame;
        }

        /**
         * Return true if the track is known to be not indexed.
         * @param track
         */
        function isNotIndexed(track) {
            return track.featureSource && track.featureSource.indexed === false;
        }


    };

    function Tile(chr, tileStart, tileEnd, scale, image) {
        this.chr = chr;
        this.startBP = tileStart;
        this.endBP = tileEnd;
        this.scale = scale;
        this.image = image;
    }

    Tile.prototype.containsRange = function (chr, start, end, scale) {
        return this.scale === scale && start >= this.startBP && end <= this.endBP && chr === this.chr;
    };

    Tile.prototype.overlapsRange = function (chr, start, end) {
        return this.chr === chr && this.endBP >= start && this.startBP <= end;
    };

    igv.TrackView.prototype.paintImage = function () {

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.tile) {
            this.xOffset = Math.round(this.browser.referenceFrame.toPixels(this.tile.startBP - this.browser.referenceFrame.start));
            this.ctx.drawImage(this.tile.image, this.xOffset, 0);
            this.ctx.save();
            this.ctx.restore();
        }
    };

    function addRulerTrackHandlers(trackView) {

        var isMouseDown = undefined,
            isMouseIn = undefined,
            mouseDownXY = undefined,
            mouseMoveXY = undefined,
            left,
            rulerSweepWidth,
            rulerWidth = $(trackView.contentDiv).width(),
            dx;

        $(document).mousedown(function (e) {

            mouseDownXY = igv.translateMouseCoordinates(e, trackView.contentDiv);

            left = mouseDownXY.x;
            rulerSweepWidth = 0;
            trackView.rulerSweeper.css({"display": "inline", "left": left + "px", "width": rulerSweepWidth + "px"});

            isMouseIn = true;
        });

        $(trackView.contentDiv).mousedown(function (e) {
            isMouseDown = true;
        });

        $(document).mousemove(function (e) {

            if (isMouseDown && isMouseIn) {

                mouseMoveXY = igv.translateMouseCoordinates(e, trackView.contentDiv);
                dx = mouseMoveXY.x - mouseDownXY.x;

                rulerSweepWidth = Math.abs(dx);

                trackView.rulerSweeper.css({"width": rulerSweepWidth + "px"});

                if (dx < 0) {
                    left = mouseDownXY.x + dx;
                    trackView.rulerSweeper.css({"left": left + "px"});
                }

                //trackView.rulerSweeper.css({backgroundColor: 'rgba(68, 134, 247, 0.75)'});
            }
        });

        $(document).mouseup(function (e) {

            var locus,
                ss,
                ee,
                trackHalfWidthBP,
                trackWidthBP,
                centroidZoom,
                chromosome,
                chromosomeLength;

            if (isMouseDown) {

                isMouseDown = false;
                isMouseIn = false;

                trackView.rulerSweeper.css({"display": "none", "left": 0 + "px", "width": 0 + "px"});

                ss = igv.browser.referenceFrame.start + (left * igv.browser.referenceFrame.bpPerPixel);
                ee = ss + rulerSweepWidth * igv.browser.referenceFrame.bpPerPixel;

                if (sweepWidthThresholdUnmet(rulerSweepWidth)) {

                    chromosome = igv.browser.genome.getChromosome(igv.browser.referenceFrame.chr);
                    chromosomeLength = chromosome.bpLength;

                    trackWidthBP = igv.browser.trackViewportWidth() / igv.browser.pixelPerBasepairThreshold();
                    trackHalfWidthBP = 0.5 * trackWidthBP;

                    centroidZoom = (ee + ss) / 2;

                    if (centroidZoom - trackHalfWidthBP < 0) {

                        ss = 1;
                        //ee = igv.browser.trackViewportWidthBP();
                        ee = trackWidthBP;
                    }
                    else if (centroidZoom + trackHalfWidthBP > chromosomeLength) {

                        ee = chromosomeLength;
                        //ss = 1 + ee - igv.browser.trackViewportWidthBP();
                        ss = 1 + ee - trackWidthBP;
                    }
                    else {
                        ss = 1 + centroidZoom - trackHalfWidthBP;
                        ee = centroidZoom + trackHalfWidthBP;
                    }

                }

                locus = igv.browser.referenceFrame.chr + ":" + igv.numberFormatter(Math.floor(ss)) + "-" + igv.numberFormatter(Math.floor(ee));
                igv.browser.search(locus);


            }

        });

        function sweepWidthThresholdUnmet(sweepWidth) {

            if ((rulerWidth / (igv.browser.referenceFrame.bpPerPixel * sweepWidth) ) > igv.browser.pixelPerBasepairThreshold()) {
                return true;
            } else {
                return false;
            }

        }

    }

    function addTrackHandlers(trackView) {

        // Register track handlers for popup.  Although we are not handling dragging here, we still need to check
        // for dragging on a mouseup

        var isMouseDown = false,
            lastMouseX = undefined,
            mouseDownX = undefined,
            popupTimer;

        $(trackView.canvas).mousedown(function (e) {

            var canvasCoords = igv.translateMouseCoordinates(e, trackView.canvas);

            if (igv.popover) {
                igv.popover.hide();
            }

            isMouseDown = true;
            lastMouseX = canvasCoords.x;
            mouseDownX = lastMouseX;


        });

        $(trackView.canvas).mouseup(function (e) {

            e = $.event.fix(e);   // Sets pageX and pageY for browsers that don't support them

            var canvasCoords = igv.translateMouseCoordinates(e, trackView.canvas),
                referenceFrame = trackView.browser.referenceFrame,
                genomicLocation = Math.floor((referenceFrame.start) + referenceFrame.toBP(canvasCoords.x));

            if (!referenceFrame) return;

            if (popupTimer) {
                // Cancel previous timer
                // console.log("Cancel timer");
                window.clearTimeout(popupTimer);
                popupTimer = undefined;
            }

            else {

                if (e.shiftKey) {

                    if (trackView.track.shiftClick && trackView.tile) {
                        trackView.track.shiftClick(genomicLocation, e);
                    }

                }
                else if (e.altKey) {

                    if (trackView.track.altClick && trackView.tile) {
                        trackView.track.altClick(genomicLocation, e);
                    }

                } else if (Math.abs(canvasCoords.x - mouseDownX) <= igv.constants.dragThreshold && trackView.track.popupData) {
                    const doubleClickDelay = 300;

                    popupTimer = window.setTimeout(function () {

                            var popupData,
                                xOrigin;

                            if (undefined === genomicLocation) {
                                return;
                            }
                            if (null === trackView.tile) {
                                return;
                            }
                            xOrigin = Math.round(referenceFrame.toPixels((trackView.tile.startBP - referenceFrame.start)));
                            popupData = trackView.track.popupData(genomicLocation, canvasCoords.x - xOrigin, canvasCoords.y);
                            if (popupData && popupData.length > 0) {
                                igv.popover.presentTrackPopup(e.pageX, e.pageY, igv.formatPopoverText(popupData), false);
                            }
                            mouseDownX = undefined;
                            popupTimer = undefined;
                        },
                        doubleClickDelay);
                }
            }

            mouseDownX = undefined;
            isMouseDown = false;
            lastMouseX = undefined;

        });

    }

    /**
     * Creates a vertical scrollbar to slide an inner "contentDiv" with respect to an enclosing "viewportDiv"
     *
     */
    TrackScrollbar = function (viewportDiv, contentDiv) {

        var outerScrollDiv = $('<div class="igv-scrollbar-outer-div">')[0],
            innerScrollDiv = $('<div class="igv-scrollbar-inner-div">')[0],
            offY;

        $(outerScrollDiv).append(innerScrollDiv);

        this.viewportDiv = viewportDiv;
        this.contentDiv = contentDiv;
        this.outerScrollDiv = outerScrollDiv;
        this.innerScrollDiv = innerScrollDiv;


        $(this.innerScrollDiv).mousedown(function (event) {
            offY = event.pageY - $(innerScrollDiv).position().top;
            $(window).on("mousemove .igv", null, null, mouseMove);
            $(window).on("mouseup .igv", null, null, mouseUp);
            event.stopPropagation();     // <= prevents start of horizontal track panning);
        });

        $(this.innerScrollDiv).click(function (event) {
            event.stopPropagation();  // "Eat" clicks on the inner div to prevent them bubbling up to outer
        });

        $(this.outerScrollDiv).click(function (event) {
            moveScrollerTo(event.offsetY - $(innerScrollDiv).height() / 2);
            event.stopPropagation();

        });

        $(this.viewportDiv).mousewheel(function (event) {

            var ratio = $(viewportDiv).height() / $(contentDiv).height();

            if (ratio < 1) {
                var dist = Math.round(ratio * event.deltaY * event.deltaFactor),
                    newY = $(innerScrollDiv).position().top + dist;
                moveScrollerTo(newY);
            }
        });

        function mouseMove(event) {
            moveScrollerTo(event.pageY - offY);
            event.stopPropagation();
        }

        function mouseUp(event) {
            $(window).off("mousemove .igv", null, mouseMove);
            $(window).off("mouseup .igv", null, mouseUp);
        };

        function moveScrollerTo(y) {
            var H = $(outerScrollDiv).height(),
                h = $(innerScrollDiv).height();
            newTop = Math.min(Math.max(0, y), H - h),
                contentTop = -Math.round(newTop * ($(contentDiv).height() / $(viewportDiv).height()));
            $(innerScrollDiv).css("top", newTop + "px");
            $(contentDiv).css("top", contentTop + "px");
        }
    }


    TrackScrollbar.prototype.update = function () {
        var viewportHeight = $(this.viewportDiv).height(),
            contentHeight = $(this.contentDiv).height(),
            newInnerHeight = Math.round((viewportHeight / contentHeight) * viewportHeight);
        if (contentHeight > viewportHeight) {
            $(this.outerScrollDiv).show();
            $(this.innerScrollDiv).height(newInnerHeight);
        }
        else {
            $(this.outerScrollDiv).hide();
        }
    }


    igv.TrackView.prototype.redrawTile = function (features) {

        if (!this.tile) return;

        var self = this,
            chr = self.tile.chr,
            bpStart = self.tile.startBP,
            bpEnd = self.tile.endBP,
            buffer = document.createElement('canvas'),
            bpPerPixel = self.tile.scale;

        buffer.width = self.tile.image.width;
        buffer.height = self.tile.image.height;
        var ctx = buffer.getContext('2d');

        self.track.draw({
            features: features,
            context: ctx,
            bpStart: bpStart,
            bpPerPixel: bpPerPixel,
            pixelWidth: buffer.width,
            pixelHeight: buffer.height
        });


        self.tile = new Tile(chr, bpStart, bpEnd, bpPerPixel, buffer);
        self.paintImage();
    }


    return igv;


})(igv || {});
