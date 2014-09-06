
// Chromosome ideogram
//

var log = function(txt) {
	console.log("karyo: "+txt);
}
var igv = (function (igv) {

    igv.KaryoPanel = function (browser) {

        this.browser = browser;
        this.div = document.createElement('div');
        this.div.style.height = "200px";
        this.div.style.width = "100%";

        this.ideograms = null;
        igv.guichromosomes = [];
        
        var contentHeight = this.div.clientHeight;
        var contentWidth = this.div.clientWidth - browser.controlPanelWidth;
        var contentDiv = document.createElement("div");
        contentDiv.style.position = "absolute";
        contentDiv.style.height = "100%";
        contentDiv.style.left = browser.controlPanelWidth + "px";
        contentDiv.style.right = "0px";
        this.div.appendChild(contentDiv);

        var canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.width = "100%";
        canvas.style.height = contentHeight;
        log("canvas height: "+ canvas.style.height);
        canvas.setAttribute('width', contentWidth);    //Must set the width & height of the canvas
        canvas.setAttribute('height', contentHeight);

  
        this.canvas = canvas;
        contentDiv.appendChild(canvas);

        this.ctx = canvas.getContext("2d");

        this.canvas.onclick = function (e) {
            var isFirefox = typeof InstallTrigger !== 'undefined';

            var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
            var isChrome = !!window.chrome && !isOpera;

            var mouseX;
            var mouseY;

            if (isFirefox) {
                // It's Firefox
                mouseX = e.layerX;
                mouseY = e.layerY;
            } else {
                // It's Chrome or Safari and works for both
                mouseX = e.offsetX;
                mouseY = e.offsetY;
            }

            this.getContext("2d").fillRect(mouseX, 0, 10, 10);
            igv.navigateKaryo(browser, mouseX, mouseY);
        }

    }

    // Move location of the reference panel by clicking on the genome ideogram
    igv.navigateKaryo = function (browser, mouseX, mouseY) {
    	// check each chromosome if the coordinates are within its bound
    	for (var i = 0; i < igv.guichromosomes.length; i++) {    		
    		var g = igv.guichromosomes[i];
    		if (g.x < mouseX && g.right > mouseX && g.y < mouseY && g.bottom > mouseY) {
    			var dy = mouseY - g.y;
    			var bp = Math.round(g.size * dy / g.h);
    			log("Going to position "+bp);
    			browser.search(g.name+":"+bp+"-"+(bp+10000));
    			break;
    		}
    	}
       
        browser.update();
    };

    igv.KaryoPanel.prototype.resize = function () {

        var contentHeight = this.div.clientHeight,
            contentWidth = this.div.clientWidth,
            canvas = this.canvas;
        canvas.style.width = "100%";
        canvas.style.height = contentHeight + "px";
        canvas.setAttribute('width', contentWidth);    //Must set the width & height of the canvas
        canvas.setAttribute('height', contentHeight);
        log("redraw: height is :"+contentHeight);      
        
        this.repaint();
    }

    igv.KaryoPanel.prototype.repaint = function () {

        var genome = this.browser.genome,
            referenceFrame = this.browser.referenceFrame,
            stainColors = [],
            w = this.canvas.width,
            h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (!(genome && genome.chromosomes)) return;

        var chromosomes = genome.getChromosomes();
        var image = this.ideograms;
        
        
        if (chromosomes.length < 1) {
        	log("No chromosomes yet, returning");
        	return;
        }
        var chrwidth = Math.min(30, w / 24);
        var chrheight = h-40;
        var longestChr = genome.getChromosome('chr1');
        var cytobands = longestChr.cytobands;
        var top = 30;
        var maxLen = cytobands[cytobands.length-1].end;
        if (!image || image == null) {
            image = document.createElement('canvas');
            image.width = w;
           
            image.height = 200;
            var bufferCtx = image.getContext('2d');
            var nr = 0;
           
            for (chr in chromosomes) {
            	if (nr > 23) break;
            	nr++;
            	var chromosome = genome.getChromosome(chr);
            	chromosome.x = nr*chrwidth;
            	var guichrom = new Object();
            	guichrom.name = chr;
            	igv.guichromosomes.push(guichrom); 
            	drawIdeogram(guichrom, chromosome.x, top, chromosome, bufferCtx, chrwidth/2,chrheight, maxLen);
            	
            }
            this.ideograms= image;           
        }
       
        
        this.ctx.drawImage(image, 0, 0);
        
        // Draw red box
        this.ctx.save();
        var chromosome = this.browser.genome.getChromosome(this.browser.referenceFrame.chr);
        cytobands = chromosome.cytobands;
        var size = cytobands[cytobands.length-1].end;
        var ideoScale = h / maxLen;

        var boxPY1 = top+Math.round(this.browser.referenceFrame.start * ideoScale);
        //var boxPY2 = Math.round((this.browser.referenceFrame.start+100) * ideoScale);
        this.ctx.strokeStyle = "red";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(chromosome.x-2, boxPY1, chrwidth/2+4, 3 );
        this.ctx.restore();
       
        function drawIdeogram(guichrom, ideogramLeft, top, chromosome, bufferCtx, ideogramWidth, ideogramHeight, longestChr) {
           
            if (!genome) return;            
            if (!chromosome) return;

            var cytobands = chromosome.cytobands;

            var centerx = (ideogramLeft + ideogramWidth / 2);
           
            var xC = [];
            var yC = [];

            var len = cytobands.length;
            if (len == 0) return;
            var scale = ideogramHeight / longestChr;
            
            guichrom.x = ideogramLeft;
            guichrom.y = top;
            guichrom.w = ideogramWidth;
            guichrom.right = ideogramLeft + ideogramWidth;
            var last = cytobands[len-1].end;
            guichrom.h = scale * last;
            guichrom.size = last;
            guichrom.longest = longestChr;
            guichrom.bottom = top +guichrom.h;
            var lastPY = -1;
            for (var i = 0; i < cytobands.length; i++) {
                var cytoband = cytobands[i];

                var starty = scale * cytoband.start + top;
                var endy = scale * cytoband.end + top;
                if (endy > lastPY) {
                    if (cytoband.type == 'c') { // centermere: "acen"
                        if (cytoband.label.charAt(0) == 'p') {
                            yC[0] = starty;
                            xC[0] = ideogramWidth + ideogramLeft;
                            yC[1] = starty;
                            xC[1] = ideogramLeft;
                            yC[2] = endy;
                            xC[2] = centerx;
                        } else {
                            yC[0] = endy;
                            xC[0] = ideogramWidth + ideogramLeft;
                            yC[1] = endy;
                            xC[1] = ideogramLeft;
                            yC[2] = starty;
                            xC[2] = centerx;
                        }
                        bufferCtx.fillStyle = "rgb(150, 0, 0)"; //g2D.setColor(Color.RED.darker());
                        bufferCtx.strokeStyle = "rgb(150, 0, 0)"; //g2D.setColor(Color.RED.darker());
                        bufferCtx.polygon(xC, yC, 1, 0);
                       // g2D.fillPolygon(xC, yC, 3);
                    } else {
                    	var dy = endy - starty;
                    	
                        bufferCtx.fillStyle = getCytobandColor(cytoband); //g2D.setColor(getCytobandColor(cytoband));
                        bufferCtx.fillRect(ideogramLeft, starty,  ideogramWidth, dy);                    
                    }
                }
                      
                lastPY = endy;

            }
            bufferCtx.fillStyle = null;
            bufferCtx.lineWidth = 1;
            bufferCtx.strokeStyle = "darkgray";
            var r = ideogramWidth / 2;
            bufferCtx.roundRect(ideogramLeft, top-r/2, ideogramWidth, lastPY-top+r, ideogramWidth / 2, 0, 1);
            
         // draw chromosome name
            
            bufferCtx.font = "bold 10px Arial";
            bufferCtx.fillStyle = "rgb(0, 0, 0)";
            bufferCtx.fillText(chromosome.name, ideogramLeft +ideogramWidth / 2-10, top-20);
        }

        function getCytobandColor(data) {
            if (data.type == 'c') { // centermere: "acen"
                return "rgb(150, 10, 10)"

            } else {
                var stain = data.stain; // + 4;

                var shade = 230;
                if (data.type == 'p') {
                    shade = Math.floor(230 - stain / 100.0 * 230);
                }
                var c = stainColors[shade];
                if (c == null) {
                    c = "rgb(" + shade + "," + shade + "," + shade + ")";
                    stainColors[shade] = c;
                }
                //log("Got color: "+c);
                return c;

            }
        }

    }

    return igv;
})
    (igv || {});