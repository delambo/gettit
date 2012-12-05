(function() {

	// Default Configuration
	// ---------------------

	var defaults = {
		// True when url param debug_assets=true.
		isDebugging: false,
		// Jammit dependency management/config file.
		assetsConfiguration: 'assets.yml',
		// Environment which determines how gettit loads.
		environment: 'production',
		// Prepended to javascript, css, and assetsConfiguration when fetching files.
		assetsPath: '',
		// Prepended to production assets.
		buildPath: '',
		// Version number appended to request urls as a query param. Useful for busting cache.
		version: '',
		// Callback called after all javascripts/templates are loaded.
		callback: function(){}
	};

	// API
	// ---

	window.gettit = {

		getLoader: function(config) {
			var options = extend(defaults, config);

			return {
				get: function(jsPackages, cssPackages, cb) {
					// Support string parameters for single packages.
					if (typeof jsPackages == 'string') jsPackages = [jsPackages];
					if (typeof cssPackages == 'string') cssPackages = [cssPackages];

					load(extend({loader:this}, options, {
						jsPackages: jsPackages || [],
						cssPackages: cssPackages || [],
						templateNamespace: 'window.JST',
						templateExtension: 'jst',
						templateFunction: '',
						callback: cb
					}));
				}
			};
		}
	};

	// Load Assets
	// -----------

	// Use the `options` to find out what mode/environment we are in - production or
	// debug/development - and load assets accordingly. In production, load js and css
	// using the given `options`. In debug/development, fetch the `options.assets` file.
	var load = function(options) {
		var cb = options.callback,
			isDebugging = options.isDebugging || (RegExp('debug_assets=(.+?)(&|$)').exec(location.search)||[,null])[1] === 'true';

		if (options.environment == 'production' && !options.isDebugging) {
			// Production mode - fetch assets directly from the `options.buildPath`.
			var jsAssets = [], cssAssets = [];
			each(options.jsPackages, function(asset) {
				jsAssets.push(isFullURL(asset) ? asset : asset += '.js');
			});
			each(options.cssPackages, function(asset) {
				cssAssets.push(isFullURL(asset) ? asset : asset += '.css');
			});

			fetchAssets(jsAssets, cssAssets, options.buildPath, '?r=' + options.version, cb);
		} else {
			// Development/debug mode - get and parse the assets file, then fetch the scripts,
			// stylesheets, and templates.
			var cacheBust = '?r=' + new Date().getTime(), parseYaml;

			parseYaml = function() {
				var yaml = options.loader.yaml, scripts = {}, css = [];
				
				extend(options, {
					templateFunction: yaml.template_function,
					templateNamespace: yaml.template_namespace,
					templateExtension: yaml.template_extension
				});

				scripts = getYamlScripts(yaml, options);
				css = getYamlCss(yaml, options);
			
				// Fetch the assets parsed from the assets yaml definition. The callback is triggered when
				// the number of pending assets hava completed - after all of the templates are compiled and
				// all scripts have loaded.
				var processedAssets = 0, pendingAssets = scripts.templates.length + 1, templateFns = [];
				// If there are no scripts or templates then we can immediately execute the callback.
				if (!scripts.js.length && !scripts.templates.length) cb();
				// Setup a callback trigger that waits for all pending assets to complete before triggering.
				var triggerCallback = function(fn) {
					if (fn) templateFns.push(fn);
					if (++processedAssets == pendingAssets) {
						each(templateFns, function(fn) { fn(); });
						cb();
					}
				};

				fetchAssets(scripts.js, css, options.assetsPath, cacheBust, triggerCallback);

				// Fetch the templates.
				each(scripts.templates, function(template) {
					fetchText(options.assetsPath+template.path, cacheBust, function(text) {
						triggerCallback(function() {
							templateCompiler.compile(options.templateNamespace, template.name, text, options.templateFunction);
						});
					});
				});
			};

			if (options.loader.yaml) parseYaml();
			else {
				// Fetch the yaml file, then parse.
				fetchText(options.assetsPath+options.assetsConfiguration, cacheBust, function(text) {
					options.loader.yaml = YAML.eval(text);
					parseYaml();
				});
			}
		}
	};
	

	// Utilities
	// ---------
	
	// Given arrays of `js` and `css` files, prepends the `path` and fetches them. Javascript is
	// downloaded in parallel, but executed in order. If `bust` is defined, then that value is
	// appended to each url. The callback ,`cb`, is fired after the last javascript executes.
	function fetchAssets(js, css, path, bust, cb) {
		var jsFiles = [];
		each(js, function(file) {
			jsFiles.push((isFullURL(file) > 0 ? file : path + file) + (bust?bust:''));
		});
		scriptLoader.$LAB.script(jsFiles).wait(function() { cb && cb(); });
		setTimeout(function() {
		if (css) {
				var head = document.getElementsByTagName('head')[0];
				each(css, function(file) {
					var el = document.createElement('link');
					el.href = (isFullURL(file) > 0 ? file : path + file) + (bust?bust:'');
					el.rel = 'stylesheet';
					el.type = 'text/css';
					head.appendChild(el);
				});
			}
		}, 1);
	}
	
	// Using xhr, fetches the text file at the given `url`. If `bust` is defined, then that value is
	// appended to the fetch url. The callback, `cb`, is fired with the returned `responseText`.
	function fetchText(url, bust, cb) {
		var xhr, isIE = navigator.appName == 'Microsoft Internet Explorer',
			isCrossDomain = url.indexOf('://') > 0 && /^\w+\:\/\/\/?[^\/]+/.exec(url)[0] != /^\w+\:\/\/\/?[^\/]+/.exec(location.href)[0];
		
		// Setup a CORS request object for IE8+.
		if (isIE && isCrossDomain) xhr = new XDomainRequest();
		else xhr = new XMLHttpRequest();
		
		xhr.open("GET", url + (bust?bust:''), true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status == 200) cb(xhr.responseText);
			return true;
		};
		xhr.send(null);
	}

	// Compiles templates using the defined `compile` api to the given `namespace`, with
	// the given `name`, compiled with the given `text`. If `func` is defined, then it will
	// be evaluated and used to compile the template; otherwise, templates are compiled with
	// a variant of John Resig's micro templating.
	var templateCompiler = (function() {
		function compileMicroTemplate(obj, name, text) {
			obj[name] = function(str){var fn = new Function('obj','var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push(\''+str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<%=([\s\S]+?)%>/g,function(match,code){return "',"+code.replace(/\\'/g, "'")+",'";}).replace(/<%([\s\S]+?)%>/g,function(match,code){return "');"+code.replace(/\\'/g, "'").replace(/[\r\n\t]/g,' ')+"__p.push('";}).replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t')+"');}return __p.join('');");return fn;}(text);
		}

		function compileFunctionTemplate(obj, name, text, func) {
			text = text.replace(/"/g, '\\"').replace(/(\r)?\n/g, "\\n");
			obj[name] = eval(func+'("'+text+'")');
		}

		return {
			compile: function(namespace, name, text, func) {
				var templateObj = eval(namespace + '=' + namespace + '||{};');
				
				if(func) compileFunctionTemplate(templateObj, name, text, func);
				else compileMicroTemplate(templateObj, name, text);
			}
		};
	})();
	
	function each(array, iterator, context) {
		if (array == null) return;
		for (var i = 0, l = array.length; i < l; i++) {
			if (i in array && iterator.call(context, array[i], i, array) === {}) return;
		}
	}

	function keys(obj) {
		var keys = [];
		for (var key in obj) if (hasOwnProperty.call(obj, key)) keys[keys.length] = key;
		return keys;
	}

	function indexOf(array, item) {
		if (array == null) return -1;
		for (var i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
		return -1;
	}

	function extend(obj) {
		each(Array.prototype.slice.call(arguments, 1), function(source) {
			for (var prop in source) {
				if (source[prop] !== void 0) obj[prop] = source[prop];
			}
		});
		return obj;
	}

	function trim(str){
		var start = -1, end = str.length;
		while(str.charCodeAt(--end) < 33);
		while(str.charCodeAt(++start) < 33);
		return str.slice(start, end + 1);
	}

	function endsWith(str, suffix) {
		return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}

	function isFullURL(url) {
		return url.indexOf('://')  >  0;
	}
	
	function getFileName(path) {
		if (!path) return null;
		if (path.indexOf('?') > -1) path = path.substring(0, path.indexOf('?'));
		return path.match(/([\w|\-|\_]*)\.\w*$/)[1];
	}

	// Finds and returns a common path prefix for the given list of `items`.
	function findCommonPathPrefix(itemList) {
		var item1, item2, s, items = itemList.slice(0).sort();
		item1 = items[0];
		s = item1.length;
		item2 = items.pop();
		while(s && item2.indexOf(item1) == -1) {
			item1 = item1.substring(0, --s);
		}
		// The prefix must end in a slash..
		item1 = item1.substring(0, item1.lastIndexOf('/') + 1);
		return item1;
	}

	// Use the given yaml and options to parse and return javascript and template paths.
	function getYamlScripts(yaml, options) {
		var scripts = { js:[], templates:[] };

		if (yaml.javascripts) {
			each(options.jsPackages, function(packageName) {
				var pkgTemplates = [], prefix, name;
				if (yaml.javascripts[packageName]) {
					// Jammit extracts template names by using the path from the common prefix of all
					// templates in a package to the extension - /common/prefix/`templ/name`.jst
					each(yaml.javascripts[packageName], function(js) {
						if (endsWith(js, '.js'))
							scripts.js.push(js);
						else if (js.substr(js.length-options.templateExtension.length) == options.templateExtension)
							pkgTemplates.push(js);
					});

					// Add an object of {path, name} to the `templates` array for each found template.
					if (pkgTemplates.length) {
						prefix = findCommonPathPrefix(pkgTemplates);
						each(pkgTemplates, function(template) {
							// Extract the template name: template path between the common prefix and the extension.
							if (prefix === template) name = getFileName(template);
							else name = new RegExp("^("+prefix+")(.+)(?=\\.)").exec(template)[2];
							scripts.templates.push({ path: template, name: name });
						});
					}
				} else if (endsWith(packageName, '.js') && isFullURL(packageName)) {
					scripts.js.push(packageName);
				}
			});
		}
		return scripts;
	}

	// Uses the given yaml and options to find and return a list of the stylesheet paths.
	function getYamlCss(yaml, options) {
		var css = [];
		if (yaml.stylesheets) {
			each(options.cssPackages, function(packageName) {
				// Remove any appended '-datauri', if it exists, to get the correct package name.
				var pkg = packageName.replace('-datauri', '');
				if (yaml.stylesheets[pkg]) css = css.concat(yaml.stylesheets[pkg]);
			});
		}
		return css;
	}

	// Script Loader
	// -------------
	
	// Ecapsulates the $LAB.js object - passed into the anonoymous function.
	var scriptLoader = {};

	// LAB.js (LABjs :: Loading And Blocking JavaScript)
	// v2.0.3 (c) Kyle Simpson
	// MIT License
	
	
/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v2.0.3 (c) Kyle Simpson
    MIT License
*/
(function(o){var K=o.$LAB,y="UseLocalXHR",z="AlwaysPreserveOrder",u="AllowDuplicates",A="CacheBust",B="BasePath",C=/^[^?#]*\//.exec(location.href)[0],D=/^\w+\:\/\/\/?[^\/]+/.exec(C)[0],i=document.head||document.getElementsByTagName("head"),L=(o.opera&&Object.prototype.toString.call(o.opera)=="[object Opera]")||("MozAppearance"in document.documentElement.style),q=document.createElement("script"),E=typeof q.preload=="boolean",r=E||(q.readyState&&q.readyState=="uninitialized"),F=!r&&q.async===true,M=!r&&!F&&!L;function G(a){return Object.prototype.toString.call(a)=="[object Function]"}function H(a){return Object.prototype.toString.call(a)=="[object Array]"}function N(a,c){var b=/^\w+\:\/\//;if(/^\/\/\/?/.test(a)){a=location.protocol+a}else if(!b.test(a)&&a.charAt(0)!="/"){a=(c||"")+a}return b.test(a)?a:((a.charAt(0)=="/"?D:C)+a)}function s(a,c){for(var b in a){if(a.hasOwnProperty(b)){c[b]=a[b]}}return c}function O(a){var c=false;for(var b=0;b<a.scripts.length;b++){if(a.scripts[b].ready&&a.scripts[b].exec_trigger){c=true;a.scripts[b].exec_trigger();a.scripts[b].exec_trigger=null}}return c}function t(a,c,b,d){a.onload=a.onreadystatechange=function(){if((a.readyState&&a.readyState!="complete"&&a.readyState!="loaded")||c[b])return;a.onload=a.onreadystatechange=null;d()}}function I(a){a.ready=a.finished=true;for(var c=0;c<a.finished_listeners.length;c++){a.finished_listeners[c]()}a.ready_listeners=[];a.finished_listeners=[]}function P(d,f,e,g,h){setTimeout(function(){var a,c=f.real_src,b;if("item"in i){if(!i[0]){setTimeout(arguments.callee,25);return}i=i[0]}a=document.createElement("script");if(f.type)a.type=f.type;if(f.charset)a.charset=f.charset;if(h){if(r){e.elem=a;if(E){a.preload=true;a.onpreload=g}else{a.onreadystatechange=function(){if(a.readyState=="loaded")g()}}a.src=c}else if(h&&c.indexOf(D)==0&&d[y]){b=new XMLHttpRequest();b.onreadystatechange=function(){if(b.readyState==4){b.onreadystatechange=function(){};e.text=b.responseText+"\n//@ sourceURL="+c;g()}};b.open("GET",c);b.send()}else{a.type="text/cache-script";t(a,e,"ready",function(){i.removeChild(a);g()});a.src=c;i.insertBefore(a,i.firstChild)}}else if(F){a.async=false;t(a,e,"finished",g);a.src=c;i.insertBefore(a,i.firstChild)}else{t(a,e,"finished",g);a.src=c;i.insertBefore(a,i.firstChild)}},0)}function J(){var l={},Q=r||M,n=[],p={},m;l[y]=true;l[z]=false;l[u]=false;l[A]=false;l[B]="";function R(a,c,b){var d;function f(){if(d!=null){d=null;I(b)}}if(p[c.src].finished)return;if(!a[u])p[c.src].finished=true;d=b.elem||document.createElement("script");if(c.type)d.type=c.type;if(c.charset)d.charset=c.charset;t(d,b,"finished",f);if(b.elem){b.elem=null}else if(b.text){d.onload=d.onreadystatechange=null;d.text=b.text}else{d.src=c.real_src}i.insertBefore(d,i.firstChild);if(b.text){f()}}function S(c,b,d,f){var e,g,h=function(){b.ready_cb(b,function(){R(c,b,e)})},j=function(){b.finished_cb(b,d)};b.src=N(b.src,c[B]);b.real_src=b.src+(c[A]?((/\?.*$/.test(b.src)?"&_":"?_")+~~(Math.random()*1E9)+"="):"");if(!p[b.src])p[b.src]={items:[],finished:false};g=p[b.src].items;if(c[u]||g.length==0){e=g[g.length]={ready:false,finished:false,ready_listeners:[h],finished_listeners:[j]};P(c,b,e,((f)?function(){e.ready=true;for(var a=0;a<e.ready_listeners.length;a++){e.ready_listeners[a]()}e.ready_listeners=[]}:function(){I(e)}),f)}else{e=g[0];if(e.finished){j()}else{e.finished_listeners.push(j)}}}function v(){var e,g=s(l,{}),h=[],j=0,w=false,k;function T(a,c){a.ready=true;a.exec_trigger=c;x()}function U(a,c){a.ready=a.finished=true;a.exec_trigger=null;for(var b=0;b<c.scripts.length;b++){if(!c.scripts[b].finished)return}c.finished=true;x()}function x(){while(j<h.length){if(G(h[j])){h[j++]();continue}else if(!h[j].finished){if(O(h[j]))continue;break}j++}if(j==h.length){w=false;k=false}}function V(){if(!k||!k.scripts){h.push(k={scripts:[],finished:true})}}e={script:function(){for(var f=0;f<arguments.length;f++){(function(a,c){var b;if(!H(a)){c=[a]}for(var d=0;d<c.length;d++){V();a=c[d];if(G(a))a=a();if(!a)continue;if(H(a)){b=[].slice.call(a);b.unshift(d,1);[].splice.apply(c,b);d--;continue}if(typeof a=="string")a={src:a};a=s(a,{ready:false,ready_cb:T,finished:false,finished_cb:U});k.finished=false;k.scripts.push(a);S(g,a,k,(Q&&w));w=true;if(g[z])e.wait()}})(arguments[f],arguments[f])}return e},wait:function(){if(arguments.length>0){for(var a=0;a<arguments.length;a++){h.push(arguments[a])}k=h[h.length-1]}else k=false;x();return e}};return{script:e.script,wait:e.wait,setOptions:function(a){s(a,g);return e}}}m={setGlobalDefaults:function(a){s(a,l);return m},setOptions:function(){return v().setOptions.apply(null,arguments)},script:function(){return v().script.apply(null,arguments)},wait:function(){return v().wait.apply(null,arguments)},queueScript:function(){n[n.length]={type:"script",args:[].slice.call(arguments)};return m},queueWait:function(){n[n.length]={type:"wait",args:[].slice.call(arguments)};return m},runQueue:function(){var a=m,c=n.length,b=c,d;for(;--b>=0;){d=n.shift();a=a[d.type].apply(null,d.args)}return a},noConflict:function(){o.$LAB=K;return m},sandbox:function(){return J()}};return m}o.$LAB=J();(function(a,c,b){if(document.readyState==null&&document[a]){document.readyState="loading";document[a](c,b=function(){document.removeEventListener(c,b,false);document.readyState="complete"},false)}})("addEventListener","DOMContentLoaded")})(scriptLoader);

	scriptLoader.$LAB.setOptions({AlwaysPreserveOrder:true});


	// Yaml Parser
	// -----------

	// Slightly reduced, modified, and fixed with original credit going to:  
	// Author: Diogo Costa  
	// This program is released under the MIT License as follows:  
	// Copyright (c) 2011 Diogo Costa (costa.h4evr@gmail.com)  
	var YAML = (function () {
		var reference_blocks = [],
			regex = {
				"regLevel": new RegExp("^([\\s\\-]+)"),
				"invalidLine": new RegExp("^\\-\\-\\-|^\\.\\.\\.|^\\s*#.*|^\\s*$"),
				"dashesString": new RegExp("^\\s*\\\"([^\\\"]*)\\\"\\s*$"),
				"quotesString": new RegExp("^\\s*\\\'([^\\\']*)\\\'\\s*$"),
				"float": new RegExp("^[+-]?[0-9]+\\.[0-9]+(e[+-]?[0-9]+(\\.[0-9]+)?)?$"),
				"integer": new RegExp("^[+-]?[0-9]+$"),
				"array": new RegExp("\\[\\s*(.*)\\s*\\]"),
				"map": new RegExp("\\{\\s*(.*)\\s*\\}"),
				"key_value": new RegExp("([a-z0-9_-][ a-z0-9_-]*):( .+)", "i"),
				"single_key_value": new RegExp("^([a-z0-9_-][ a-z0-9_-]*):( .+?)$", "i"),
				"key": new RegExp("([a-z0-9_-][ a-z0-9_-]+):( .+)?", "i"),
				"item": new RegExp("^-\\s+"),
				"trim": new RegExp("^\\s+|\\s+$"),
				"comment": new RegExp("([^\\\'\\\"#]+([\\\'\\\"][^\\\'\\\"]*[\\\'\\\"])*)*(#.*)?")
			};

		function Block(lvl) {
			return { /* The block's parent */
				parent: null,
				/* Number of children */
				length: 0,
				/* Block's level */
				level: lvl,
				/* Lines of code to process */
				lines: [],
				/* Blocks with greater level */
				children: [],
				/* Add a block to the children collection */
				addChild: function (obj) {
					this.children.push(obj);
					obj.parent = this;
					++this.length;
				}
			};
		}

		function parser(str) {
			var regLevel = regex["regLevel"];
			var invalidLine = regex["invalidLine"];
			var lines = str.split("\n");
			var m;
			var level = 0, curLevel = 0;

			var blocks = [];

			var result = new Block(-1);
			var currentBlock = new Block(0);
			result.addChild(currentBlock);
			var levels = [];
			var line = "";

			blocks.push(currentBlock);
			levels.push(level);

			for (var i = 0, len = lines.length; i < len; ++i) {
				line = lines[i];

				if (line.match(invalidLine)) {
					continue;
				}

				if (m = regLevel.exec(line)) {
					level = m[1].length;
				} else level = 0;

				if (level > curLevel) {
					var oldBlock = currentBlock;
					currentBlock = new Block(level);
					oldBlock.addChild(currentBlock);
					blocks.push(currentBlock);
					levels.push(level);
				} else if (level < curLevel) {
					var added = false;

					var k = levels.length - 1;
					for (; k >= 0; --k) {
						if (levels[k] == level) {
							currentBlock = new Block(level);
							blocks.push(currentBlock);
							levels.push(level);
							if (blocks[k].parent != null) blocks[k].parent.addChild(currentBlock);
							added = true;
							break;
						}
					}

					if (!added) {
						return;
					}
				}

				currentBlock.lines.push(line.replace(regex["trim"], ""));
				curLevel = level;
			}

			return result;
		}

		function processValue(val) {
			val = val.replace(regex["trim"], "");
			var m = null;

			if (val == 'true') {
				return true;
			} else if (val == 'false') {
				return false;
			} else if (val == '.NaN') {
				return Number.NaN;
			} else if (val == 'null') {
				return null;
			} else if (val == '.inf') {
				return Number.POSITIVE_INFINITY;
			} else if (val == '-.inf') {
				return Number.NEGATIVE_INFINITY;
			} else if (m = val.match(regex["dashesString"])) {
				return m[1];
			} else if (m = val.match(regex["quotesString"])) {
				return m[1];
			} else if (m = val.match(regex["float"])) {
				return parseFloat(m[0]);
			} else if (m = val.match(regex["integer"])) {
				return parseInt(m[0]);
			} else if (m = val.match(regex["single_key_value"])) {
				var res = {};
				res[m[1]] = processValue(m[2]);
				return res;
			} else if (m = val.match(regex["array"])) {
				var count = 0,
					c = ' ';
				var res = [];
				var content = "";
				var str = false;
				for (var j = 0, lenJ = m[1].length; j < lenJ; ++j) {
					c = m[1][j];
					if (c == '\'' || c == '"') {
						if (str === false) {
							str = c;
							content += c;
							continue;
						} else if ((c == '\'' && str == '\'') || (c == '"' && str == '"')) {
							str = false;
							content += c;
							continue;
						}
					} else if (str === false && (c == '[' || c == '{')) {
						++count;
					} else if (str === false && (c == ']' || c == '}')) {
						--count;
					} else if (str === false && count == 0 && c == ',') {
						res.push(processValue(content));
						content = "";
						continue;
					}

					content += c;
				}

				if (content.length > 0) res.push(processValue(content));
				return res;
			} else if (m = val.match(regex["map"])) {
				var count = 0,
					c = ' ';
				var res = [];
				var content = "";
				var str = false;
				for (var j = 0, lenJ = m[1].length; j < lenJ; ++j) {
					c = m[1][j];
					if (c == '\'' || c == '"') {
						if (str === false) {
							str = c;
							content += c;
							continue;
						} else if ((c == '\'' && str == '\'') || (c == '"' && str == '"')) {
							str = false;
							content += c;
							continue;
						}
					} else if (str === false && (c == '[' || c == '{')) {
						++count;
					} else if (str === false && (c == ']' || c == '}')) {
						--count;
					} else if (str === false && count == 0 && c == ',') {
						res.push(content);
						content = "";
						continue;
					}

					content += c;
				}

				if (content.length > 0) res.push(content);

				var newRes = {};
				for (var j = 0, lenJ = res.length; j < lenJ; ++j) {
					if (m = res[j].match(regex["key_value"])) {
						newRes[m[1]] = processValue(m[2]);
					}
				}

				return newRes;
			} else return val;
		}

		function processFoldedBlock(block) {
			var lines = block.lines;
			var children = block.children;
			var str = lines.join(" ");
			var chunks = [str];
			for (var i = 0, len = children.length; i < len; ++i) {
				chunks.push(processFoldedBlock(children[i]));
			}
			return chunks.join("\n");
		}

		function processLiteralBlock(block) {
			var lines = block.lines;
			var children = block.children;
			var str = lines.join("\n");
			for (var i = 0, len = children.length; i < len; ++i) {
				str += processLiteralBlock(children[i]);
			}
			return str;
		}

		function processBlock(blocks) {
			var m = null;
			var res = {};
			var lines = null;
			var children = null;
			var currentObj = null;

			var level = -1;

			var processedBlocks = [];

			var isMap = true;

			for (var j = 0, lenJ = blocks.length; j < lenJ; ++j) {

				if (level != -1 && level != blocks[j].level) continue;

				processedBlocks.push(j);

				level = blocks[j].level;
				lines = blocks[j].lines;
				children = blocks[j].children;
				currentObj = null;

				for (var i = 0, len = lines.length; i < len; ++i) {
					var line = lines[i];

					if (m = line.match(regex["key"])) {
						var key = m[1];

						if (key[0] == '-') {
							key = key.replace(regex["item"], "");
							if (isMap) {
								isMap = false;
								if (typeof (res.length) === "undefined") {
									res = [];
								}
							}
							if (currentObj != null) res.push(currentObj);
							currentObj = {};
							isMap = true;
						}

						if (typeof m[2] != "undefined") {
							var value = m[2].replace(regex["trim"], "");
							if (value[0] == '&') {
								var nb = processBlock(children);
								if (currentObj != null) currentObj[key] = nb;
								else res[key] = nb;
								reference_blocks[value.substr(1)] = nb;
							} else if (value[0] == '|') {
								if (currentObj != null) currentObj[key] = processLiteralBlock(children.shift());
								else res[key] = processLiteralBlock(children.shift());
							} else if (value[0] == '*') {
								var v = value.substr(1);
								var no = {};

								if (typeof reference_blocks[v] != "undefined") {
									for (var k in reference_blocks[v]) {
										no[k] = reference_blocks[v][k];
									}

									if (currentObj != null) currentObj[key] = no;
									else res[key] = no;
								}
							} else if (value[0] == '>') {
								if (currentObj != null) currentObj[key] = processFoldedBlock(children.shift());
								else res[key] = processFoldedBlock(children.shift());
							} else {
								if (currentObj != null) currentObj[key] = processValue(value);
								else res[key] = processValue(value);
							}
						} else {
							if (currentObj != null) currentObj[key] = processBlock(children);
							else res[key] = processBlock(children);
						}
					} else if (line.match(/^-\s*$/)) {
						if (isMap) {
							isMap = false;
							if (typeof (res.length) === "undefined") {
								res = [];
							}
						}
						if (currentObj != null) res.push(currentObj);
						currentObj = {};
						isMap = true;
						continue;
					} else if (m = line.match(/^-\s*(.*)/)) {
						if (currentObj != null) currentObj.push(processValue(m[1]));
						else {
							if (isMap) {
								isMap = false;
								if (typeof (res.length) === "undefined") {
									res = [];
								}
							}
							res.push(processValue(m[1]));
						}
						continue;
					}
				}

				if (currentObj != null) {
					if (isMap) {
						isMap = false;
						if (typeof (res.length) === "undefined") {
							res = [];
						}
					}
					res.push(currentObj);
				}
			}

			for (var j = processedBlocks.length - 1; j >= 0; --j) {
				blocks.splice.call(blocks, processedBlocks[j], 1);
			}

			return res;
		}

		function semanticAnalysis(blocks) {
			var res = processBlock(blocks.children);
			return res;
		}

		function preProcess(src) {
			var m;
			var lines = src.split("\n");

			var r = regex["comment"];

			for (var i in lines) {
				if (lines.hasOwnProperty(i) && (m = lines[i].match(r))) {
					if (typeof m[3] !== "undefined") {
						lines[i] = m[0].substr(0, m[0].length - m[3].length);
					}
				}
			}

			return lines.join("\n");
		}

		function eval(str) {
			reference_blocks = [];
			var pre = preProcess(str)
			var doc = parser(pre);
			var res = semanticAnalysis(doc);

			return res;
		}

		return {
			eval: eval
		}
	})();
	
})();
