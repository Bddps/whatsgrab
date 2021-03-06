var Spooky 	= require('spooky');
var Q		= require('q');

var spooky;
var c = {
	channel: "",
	defer: null,
	qr: null,
	messages: {},
	timeout: 22000,
	loadtime: 20000,
	yourUsername: "Ben"
};

c.setup = function (url, channel){
	var defer = Q.defer();
	c.channel = channel;
	
	console.log("Starting SpookyJS...");
	
	spooky = new Spooky({
		casper: {
			logLevel: 'debug',
			verbose: true,
			pageSettings: {
				userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36"
			},
			waitTimeout: 60000
		},
		child: {
			'ignore-ssl-errors': true,
			'ssl-protocol': 'tlsv1'
		}
	}, function (err){

		if (err) {
			e = new Error('Failed to start SpookyJS');
			e.details = err;
			defer.reject(e);
			throw e;
		}
		
		spooky.start(url);
		// spooky.then([{commands: scraper}, function (){
		// 	window.coms = commands;
		// }]);
		console.log("SpookyJS Ready");
		
		// Initialise Casperjs
		spooky.then([{config: c}, function (){
			// Casper Context
			window.c = config;
			this.page.injectJs('./utils/javascript/jquery.min.js');
			
			console.log("Pinging CasperJS");
			this.emit('report', "Running CasperJS");
			
			this.emit('report', this.evaluate(function (){
				return document.title;
			}));
			
			this.evaluate(function (){
				window.loaded = false;
				
				function checkLoad() {
					window.loaded = true;
				}
				
				window.onload = checkLoad;
			})

		}]);

		spooky.then(function start (){
			
			// Get QR Code data value
			// this.waitFor(function (){
			// 		return this.evaluate(function (){
			// 			return window.loaded;
			// 		});
			this.wait(20000, function (){
					var qrDetails = this.evaluate(function (){
					var els = document.querySelector('img');
					
					return els.getAttribute('src');
					
				});
				
				if (qrDetails === null || qrDetails === 'undefined') {
					this.emit('error', "Could not find QR code");
				}
				
				this.emit('checkpoint', {
					name: "qr",
					value: qrDetails
				});
			});
			
		});
		
		spooky.then(function (){
			
			// Wait for qr to be validated
			this.wait(window.c.timeout, function (){
				this.emit('report', "QR Code lifetime over");
			});
			
		});
		
		spooky.then(function (){
			
			this.wait(window.c.loadtime, function (){
				// Click on target channel
				this.click("//span[contains(., '" + window.c.channel + "')]");
			});
			
			this.wait(1000, function (){
				// Get all messages HTML and extract to json
				var msgs = this.evaluate(function (defaultAuthor){
					
					var pane = document.querySelector('.message-list');
					var rawMessages = pane.querySelectorAll('.msg');
					
					// A message will either be:
					// - From you (no author),
					// - From system (ignored),
					// - From group (with author),
					// - Contain preview image,
					// - Contain image and caption,
					// - Continuation message (author from previous message)

					// List of all messsages retrieved in json format
					var messageList = [];
					// Used to link continuation msgs to author
					var messageLink = '';

					for (var i = 0; i < rawMessages.length; i++) {
						var message = {
							author: '',
							text: '',
							image: '',
							time: ''
						}
						var rawMessage = rawMessages[i];
						var rmCheck = rawMessage.querySelector('.message');

						// System Message
						if (rmCheck.classList.contains('message-system'))
							continue;
						
						if (rmCheck.classList.contains('message-in')) {
							var author = rmCheck.querySelector('.emojitext').innerHTML;
							// Message has no author, refer to previous message
							if (messageLink != '')
								author = messageLink;

							var content = rmCheck.querySelector('.message-text').querySelector('.emojitext');

							// Emoji Capture
							for (node in content.childNodes) {
								if (typeof node === 'string') {
									// Text content
									message.text += node;
								} else {
									// Emoji
									message.text += node.getAttribute('alt');
								}
							}
						}

						// Message chain has finished, clear messageLink
						if (rmCheck.classList.contains('tail'))
							messageLink = "";
						else if (rawMessage.classList.contains('msg-continuation') && messageLink == '')
							messageLink == author;
						

						messageList.push(message);
					}
					
					return messageList;

				}, window.c.yourUsername);

				this.emit('report', msgs);
			});
			
		});
		
		defer.resolve();
	});
	
	spooky.on('error', function (e, stack){
		
		if (stack) {
			console.log(stack);
		}
		
		c.defer.reject(e);
	});
	
	spooky.on("resource.error", function(resourceError){
		console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
		console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
	});

	spooky.on('report', function (greeting){
		console.log(greeting);
	});

	spooky.on('console', function (log){
		console.log(log);
	});
	
	return defer.promise;
};

c.start = function (){
	c.defer = Q.defer();
	
	spooky.on('checkpoint', function (varible){
		c[varible.name] = varible.value;
		
		console.log("Checkpoint Reached, var [" + varible.name + "] updated");
		console.log("Call continue() or kill()!");
		
		c.defer.resolve(varible.value);
	})
	
	spooky.on('complete', function (res){
		c.kill(res);
	});
	
	spooky.run();

	console.log("Running SpookyJS");
	
	return c.defer.promise;
};

c.continue = function (){
	c.defer = Q.defer();
	
	console.log("Continuing to listen to spookyjs");
	
	return c.defer.promise;
}

c.kill = function (res){
	console.log("Run Complete, killing spookyjs");
	spooky.destroy();
	c.defer.resolve(res);
}

c.test = function (){
	var test = require('./package.json');
	console.log("You are using: " + test.version);
}

module.exports = c;