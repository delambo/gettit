$(document).ready(function() {

	module("environment=development");

	test('assets.yml:javascripts/stylesheets bundles', 7, function() {
		var scriptCount = document.getElementsByTagName('script').length;
		var stylesheetCount = document.getElementsByTagName('link').length;

		var loader = gettit.getLoader({
			assetsConfiguration: 'assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev1/',
			version: new Date().getTime(),
			callback: function(){}
		});

		stop();
		loader.get('testj1', 'testc1', function() {
			equal(document.getElementsByTagName('script').length, scriptCount + 2);
			equal(document.getElementsByTagName('link').length, stylesheetCount + 2);

			loader.get('testj2', 'testc2', function() {

				equal(document.getElementsByTagName('script').length, scriptCount + 3);
				equal(document.getElementsByTagName('link').length, stylesheetCount + 3);
				start();
			});
		});

		// Setup a function for scripts to call when they are executed (in order)
		var count = 0;
		window.dev1 = function(fromScript) {
			equal(count++, fromScript);
		};
	});

	test('assets.yml:template_function (micro template compiling)', 2, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'micro-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function(){}
		});

		stop();
		loader.get(['testj1'], null, function() {
			equal(window.JST['test1/test']({test1:'eat',test2:'fork'}), '<div>eat me</div>\n<div>fork socket</div>\n');
			equal(window.JST['test2/test']({test:'east'}), '<div>east coast hackers</div>\n');
			delete window.JST;
			start();
		});
	});


	test('assets.yml:template_function:_.template', 2, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'underscore-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function(){}
		});

		stop();
		loader.get(['http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.2.2/underscore-min.js', 'testj1'], null, function() {
			equal(window.JST['test1/test']({test1:'eat',test2:'fork'}), '<div>eat me</div>\n<div>fork socket</div>\n');
			equal(window.JST['test2/test']({test:'east'}), '<div>east coast hackers</div>\n');
			delete window.JST;
			start();
		});
	});


	test('assets.yml:template_namespace', 2, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'namespace-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function(){}
		});

		stop();
		loader.get(['testj1'], null, function() {
			equal(window.dev2['test1/test']({test1:'eat',test2:'fork'}), '<div>eat me</div>\n<div>fork socket</div>\n');
			equal(window.dev2['test2/test']({test:'east'}), '<div>east coast hackers</div>\n');
			delete window.JST;
			start();
		});
	});


	test('assets.yml:template_extension', 2, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'extension-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function(){}
		});

		stop();
		loader.get(['testj1'], null, function() {
			equal(window.dev2['test1/test']({test1:'eat',test2:'fork'}), '<div>eat me</div>\n<div>fork socket</div>\n');
			equal(window.dev2['test2/test']({test:'east'}), '<div>east coast hackers</div>\n');
			start();
		});
	});


	test('callback', 1, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'micro-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function() {
				ok(true);
				start();
			}
		});
		stop();
		loader.get(['testj1'], null);
	});


	test('callback (no templates)', 1, function() {
		var loader = gettit.getLoader({
			assetsConfiguration: 'micro-assets.yml',
			environment: 'development',
			assetsPath: 'assets/dev2/',
			version: new Date().getTime(),
			callback: function() {
				ok(true);
				start();
			}
		});
		stop();
		loader.get(['testj1'], ['testc1']);
	});

});
