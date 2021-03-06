/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 University of California San Diego
 * Author: Jim Robinson
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


    igv.BigQueryFeatureReader = function (config) {

        // Harcoded for seg features for now
        this.projectId = 'isb-cgc-03-0001';
        this.decode = decodeSeg;
        this.cohort = config.cohort

    }

    //SELECT ParticipantBarcode FROM [isb-cgc:tcga_201510_alpha.Clinical_data] WHERE Study = \"" + this.study + "\")

    igv.BigQueryFeatureReader.prototype.allSamples = function () {

        var q = "SELECT UNIQUE(AliquotBarcode) FROM  [isb-cgc:tcga_201510_alpha.Copy_Number_segments] WHERE " +
            " ParticipantBarcode IN (" + this.cohort + ")";

        return igv.bigQuery(
            {
                projectId: this.projectId,
                queryString: q,
                decode: decodeSample
            });

    }

    igv.BigQueryFeatureReader.prototype.readFeatures = function (chr, bpStart, bpEnd) {

        var c = chr.startsWith("chr") ? chr.substring(3) : chr,
            q = "SELECT * FROM [isb-cgc:tcga_201510_alpha.Copy_Number_segments]" +
                " WHERE " +
                " ParticipantBarcode IN (" + this.cohort + ") " +
                " AND Chromosome = \"" + c + "\" " +
                " AND Start >= " + bpStart + " AND End <= " + bpEnd;

        return igv.bigQuery(
            {
                projectId: this.projectId,
                queryString: q,
                decode: decodeSeg
            });

    }


    igv.bigQuery = function (options) {

        return new Promise(function (fulfill, reject) {

            if (!options.projectId) {
                //todo throw error
            }

            var baseURL = options.baseURL || "https://www.googleapis.com/bigquery/v2/",
                url = baseURL + "projects/" + options.projectId + "/queries",
                body = {
                    "kind": "bigquery#queryRequest",
                    "query": options.queryString,
                    "maxResults": 1000,
                    "timeoutMs": 5000,
                    "dryRun": false,
                    "preserveNulls": true,
                    "useQueryCache": true
                },
                decode = options.decode,
                apiKey = oauth.google.apiKey,
                jobId,
                paramSeparator = "&";

            url = url + "?alt=json";

            if (apiKey) {
                url = url + paramSeparator + "key=" + apiKey;
            }

            var sendData = JSON.stringify(body);

            igvxhr.loadJson(url,
                {
                    sendData: sendData,
                    contentType: "application/json"
                }).then(function (response) {

                var results = [],
                    totalRows,
                    jobId = response.jobReference.jobId;


                if (response.jobComplete === true) {

                    totalRows = parseInt(response.totalRows);   // Google convention is to use strings for "long" types

                    if (totalRows === 0) {
                        fulfill(results);
                    }
                    else {

                        response.rows.forEach(function (row) {
                            results.push(decode(row));
                        });

                        if (results.length < totalRows) {
                            getQueryResults(options);
                        }
                        else {
                            fulfill(results);
                        }
                    }
                }
                else {
                    setTimeout(function () {
                        getQueryResults(options);
                    }, 1000);
                }


                function getQueryResults(options) {

                    var url = "https://clients6.google.com/bigquery/v2/projects/" + options.projectId + "/queries/" + jobId,
                        decode = options.decode,
                        success = options.success,
                        apiKey = oauth.google.apiKey,
                        paramSeparator = "&";

                    url = url + "?alt=json"

                    if (apiKey) {
                        url = url + paramSeparator + "key=" + apiKey;
                    }

                    if (options.maxResults) {
                        url = url + "&maxResults=" + options.maxResults;
                    }

                    if (results.length > 0) {
                        url = url + ("&startIndex=" + results.length);
                    }

                    igvxhr.loadJson(url,
                        {
                            contentType: "application/json"
                        }).then(function (response) {

                        if (response.jobComplete === true) {

                            totalRows = response.totalRows;

                            response.rows.forEach(function (row) {
                                results.push(decode(row));
                            });

                            if (results.length < totalRows) {
                                getQueryResults(options);
                            }
                            else {
                                fulfill(results);
                            }

                        }
                        else {
                            setTimeout(function () {
                                getQueryResults(options);
                            }, 1000);
                        }

                    });

                }

            }).catch(reject);
        });
    }


    /*
     sample: tokens[sampleColumn],
     chr: tokens[chrColumn],
     start: parseInt(tokens[startColumn]),
     end: parseInt(tokens[endColumn]),
     value: parseFloat(tokens[dataColumn])
     */

    function decodeSeg(row) {

        var seg = {};
        seg["sample"] = row.f[3].v;
        seg["Study"] = row.f[4].v;
        seg["chr"] = row.f[6].v;
        seg["start"] = row.f[7].v - 1;
        seg["end"] = row.f[8].v;
        seg["Num_Probes"] = row.f[9].v;
        seg["value"] = row.f[10].v;
        return seg;
    }


    function decodeStudy(row) {

        return row.f[0].v;
    }

    function decodeSample(row) {
        return row.f[0].v;
    }


    return igv;

})(igv || {});