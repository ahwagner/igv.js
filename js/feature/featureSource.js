/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014-2015 Broad Institute
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

    const MAX_GZIP_BLOCK_SIZE = (1 << 16);

    /**
     * feature source for "bed like" files (tab delimited files with 1 feature per line: bed, gff, vcf, etc)
     *
     * @param config
     * @constructor
     */
    igv.FeatureSource = function (config) {

        this.config = config || {};

        this.sourceType = (config.sourceType === undefined ? "file" : config.sourceType);

        if (config.sourceType === "ga4gh") {
            this.reader = new igv.Ga4ghVariantReader(config);
        } else if (config.sourceType === "immvar") {
            this.reader = new igv.ImmVarReader(config);
        } else if (config.type === "eqtl") {
            if (config.sourceType === "gtex-ws") {
                this.reader = new igv.GtexReader(config);
            }
            else {
                this.reader = new igv.GtexFileReader(config);
            }
        } else if (config.sourceType === "bigquery") {
            this.reader = new igv.BigQueryFeatureReader(config);
        }
        else {
            // Default for all sorts of ascii tab-delimited file formts
            this.reader = new igv.FeatureFileReader(config);
        }
        this.visibilityWindow = config.visibilityWindow;

    };

    igv.FeatureSource.prototype.getFileHeader = function () {

        var self = this,
            maxRows = this.config.maxRows || 500;

        return new Promise(function (fulfill, reject) {

            if (typeof self.reader.readHeader === "function") {
                self.reader.readHeader().then(function (header, features) {
                    // Non-indexed readers will return features as a side effect.  This is an important performance hack
                    if (features) {
                        // Assign overlapping features to rows
                        packFeatures(features, maxRows);
                        self.featureCache = new igv.FeatureCache(features);

                        // If track is marked "searchable"< cache features by name -- use this with caution, memory intensive
                        if (self.config.searchable) {
                            addFeaturesToDB(features);
                        }
                    }
                    fulfill(header);
                }).catch(reject);
            }
            else {
                fulfill(null);
            }
        });
    }

    function addFeaturesToDB(featureList) {
        featureList.forEach(function (feature) {
            if (feature.name) {
                igv.browser.featureDB[feature.name.toUpperCase()] = feature;
            }
        })
    }


    /**
     * Required function fo all data source objects.  Fetches features for the
     * range requested and passes them on to the success function.  Usually this is
     * a function that renders the features on the canvas
     *
     * @param chr
     * @param bpStart
     * @param bpEnd
     */

    igv.FeatureSource.prototype.getFeatures = function (chr, bpStart, bpEnd) {

        var self = this;
        return new Promise(function (fulfill, reject) {

            var genomicInterval = new igv.GenomicInterval(chr, bpStart, bpEnd),
                featureCache = self.featureCache,
                maxRows = self.config.maxRows || 500;

            if (featureCache && (featureCache.range === undefined || featureCache.range.containsRange(genomicInterval))) {
                fulfill(self.featureCache.queryFeatures(chr, bpStart, bpEnd));

            }
            else {
                // TODO -- reuse cached features that overelap new region

                if(self.sourceType === 'file' && (self.visibilityWindow === undefined || self.visibilityWindow <= 0)) {
                    // Expand genomic interval to grab entire chromosome
                    genomicInterval.start = 0;
                    genomicInterval.end = Number.MAX_VALUE;
                }

                self.reader.readFeatures(chr, genomicInterval.start, genomicInterval.end).then(

                    function (featureList) {

                        if (featureList && typeof featureList.forEach === 'function') {  // Have result AND its an array type

                            var isIndexed =
                                self.reader.indexed ||
                                self.config.sourceType === "ga4gh" ||
                                self.config.sourceType === "immvar" ||
                                self.config.sourceType === "gtex" ||
                                self.config.sourceType === "bigquery";

                            self.featureCache = isIndexed ?
                                new igv.FeatureCache(featureList, genomicInterval) :
                                new igv.FeatureCache(featureList);   // Note - replacing previous cache with new one


                            // If track is marked "searchable"< cache features by name -- use this with caution, memory intensive
                            if (self.config.searchable) {
                                addFeaturesToDB(featureList);
                            }

                            // Assign overlapping features to rows
                            packFeatures(featureList, maxRows);

                            // Finally pass features for query interval to continuation
                            fulfill(self.featureCache.queryFeatures(chr, bpStart, bpEnd));
                        }
                        else {
                            fulfill(null);
                        }

                    }).catch(reject);
            }
        });
    }


    function packFeatures(features, maxRows) {

        if (features == null || features.length === 0) {
            return;
        }

        // Segregate by chromosome

        var chrFeatureMap = {},
            chrs = [];
        features.forEach(function (feature) {

            var chr = feature.chr,
                flist = chrFeatureMap[chr];

            if (!flist) {
                flist = [];
                chrFeatureMap[chr] = flist;
                chrs.push(chr);
            }

            flist.push(feature);
        });

        // Loop through chrosomosomes and pack features;

        chrs.forEach(function (chr) {

            pack(chrFeatureMap[chr], maxRows);
        });


        // Assigns a row # to each feature.  If the feature does not fit in any row and #rows == maxRows no
        // row number is assigned.
        function pack(featureList, maxRows) {

            var rows = [];

            featureList.sort(function (a, b) {
                return a.start - b.start;
            })


            rows.push(-1000);
            featureList.forEach(function (feature) {

                var i,
                    r,
                    len = Math.min(rows.length, maxRows),
                    start = feature.start;

                for (r = 0; r < len; r++) {
                    if (start > rows[r]) {
                        feature.row = r;
                        rows[r] = feature.end;
                        return;
                    }
                }
                feature.row = r;
                rows[r] = feature.end;


            });
        }
    }

    return igv;
})
(igv || {});
