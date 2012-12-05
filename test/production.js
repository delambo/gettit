$(document).ready(function() {

	module("environment=production");

	// Runs the following test when `debug_assets=true` is a url parameter
	if (location.search.indexOf('debug_assets=true') > -1) {
	
		test('?debug_assets=true', 4, function() {
			var scriptCount = document.getElementsByTagName('script').length;
			var stylesheetCount = document.getElementsByTagName('link').length;

			var loader = gettit.getLoader({
				assetsConfiguration: 'assets.yml',
				environment: 'production',
				assetsPath: 'assets/prod1/',
				buildPath: 'assets/prod1/build/',
				version: new Date().getTime(),
				callback: function(){}
			});

			stop();
			loader.get(['test1', 'test2'], ['test1', 'test2'], function() {
				equal(document.getElementsByTagName('script').length, scriptCount + 2);
				equal(document.getElementsByTagName('link').length, stylesheetCount + 2);
				start();
			});

			// Setup a function for scripts to call when they are executed (in order)
			var count = 0;
			window.prod1 = function(fromScript) {
				equal(count++, fromScript);
			};
		});

	} else {
		// Run non-debug_assets production tests.

		test('with full urls', 5, function() {
			var scriptCount = document.getElementsByTagName('script').length;
			var stylesheetCount = document.getElementsByTagName('link').length;

			var loader = gettit.getLoader({
				assetsConfiguration: 'assets.yml',
				environment: 'production',
				assetsPath: 'assets/prod3/',
				buildPath: 'assets/prod3/build/',
				version: new Date().getTime(),
				callback: function(){}
			});

			stop();
			loader.get([
					'test1',
					'test2',
					'http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.2.2/underscore-min.js',
					'http://cdnjs.cloudflare.com/ajax/libs/backbone.js/0.5.0/backbone-min.js'],
					['test1', 'test2'],
					function() {
				equal(document.getElementsByTagName('script').length, scriptCount + 4);
				ok(window._);
				ok(window.Backbone);
				start();
			});

			// Setup a function for scripts to call when they are executed (in order)
			var count = 0;
			window.prod3 = function(fromScript) {
				equal(count++, fromScript);
			};
		});


		test('callback', 4, function() {
			var scriptCount = document.getElementsByTagName('script').length;
			var stylesheetCount = document.getElementsByTagName('link').length;

			var loader = gettit.getLoader({
				assetsConfiguration: 'assets.yml',
				environment: 'production',
				assetsPath: 'assets/prod1/',
				buildPath: 'assets/prod1/build/',
				version: new Date().getTime(),
				callback: function() {
					equal(document.getElementsByTagName('script').length, scriptCount + 2);
					equal(document.getElementsByTagName('link').length, stylesheetCount + 2);
					start();
				}
			});

			stop();
			loader.get(['test1', 'test2'], ['test1', 'test2']);

			// Setup a function for scripts to call when they are executed (in order)
			var count = 0;
			window.prod1 = function(fromScript) {
				equal(count++, fromScript);
			};
		});
	}

});
