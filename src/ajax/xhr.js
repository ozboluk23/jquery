(function( jQuery ) {

var // Next active xhr id
	xhrId = jQuery.now(),

	// active xhrs
	xhrs = {},

	// #5280: see below
	xhrUnloadAbortInstalled,

	// XHR used to determine supports properties
	testXHR;

// Create the request object; Microsoft failed to properly
// (This is still attached to ajaxSettings for backward compatibility reasons)
jQuery.ajaxSettings.xhr = window.ActiveXObject ?
	/* Microsoft failed to properly
	 * implement the XMLHttpRequest in IE7 (can't request local files),
	 * so we use the ActiveXObject when it is available
	 * Additionally XMLHttpRequest can be disabled in IE7/IE8 so
	 * we need a fallback.
	 */
	function() {
		if ( window.location.protocol !== "file:" ) {
			try {
				return new window.XMLHttpRequest();
			} catch( xhrError ) {}
		}

		try {
			return new window.ActiveXObject("Microsoft.XMLHTTP");
		} catch( activeError ) {}
	} :
	// For all other browsers, use the standard XMLHttpRequest object
	function() {
		return new window.XMLHttpRequest();
	};

// Test if we can create an xhr object
try {
	testXHR = jQuery.ajaxSettings.xhr();
} catch( xhrCreationException ) {}

//Does this browser support XHR requests?
jQuery.support.ajax = !!testXHR;

// Does this browser support crossDomain XHR requests
jQuery.support.cors = testXHR && "withCredentials" in testXHR;

// No need for the temporary xhr anymore
testXHR = undefined;

// Create transport if the browser can provide an xhr
if ( jQuery.support.ajax ) {
	jQuery.ajaxTransport( function( s ) {

		// Cross domain only allowed if supported through XMLHttpRequest
		if ( ! s.crossDomain || jQuery.support.cors ) {

			var callback;

			return {

				send: function(headers, complete) {

					// #5280: we need to abort on unload or IE will keep connections alive
					if ( ! xhrUnloadAbortInstalled ) {

						xhrUnloadAbortInstalled = 1;

						jQuery(window).bind( "unload" , function() {

							// Abort all pending requests
							jQuery.each(xhrs, function(_, xhr) {
								if ( xhr.onreadystatechange ) {
									xhr.onreadystatechange( 1 );
								}
							});

						});
					}

					// Get a new xhr
					var xhr = s.xhr(),
						handle;

					// Open the socket
					// Passing null username, generates a login popup on Opera (#2865)
					if ( s.username ) {
						xhr.open(s.type, s.url, s.async, s.username, s.password);
					} else {
						xhr.open(s.type, s.url, s.async);
					}

					// Requested-With header
					// Not set for crossDomain requests with no content
					// (see why at http://trac.dojotoolkit.org/ticket/9486)
					// Won't change header if already provided
					if ( ! ( s.crossDomain && ! s.hasContent ) && ! headers["x-requested-with"] ) {
						headers["x-requested-with"] = "XMLHttpRequest";
					}

					// Need an extra try/catch for cross domain requests in Firefox 3
					try {

						jQuery.each(headers, function(key,value) {
							xhr.setRequestHeader(key,value);
						});

					} catch(_) {}

					// Do send the request
					try {
						xhr.send( ( s.hasContent && s.data ) || null );
					} catch(e) {
						complete(0, "error", "" + e);
						return;
					}

					// Listener
					callback = function( _ , isAbort ) {

						// Was never called and is aborted or complete
						if ( callback && ( isAbort || xhr.readyState === 4 ) ) {

							// Only called once
							callback = 0;

							// Do not keep as active anymore
							// and store back into pool
							if (handle) {
								xhr.onreadystatechange = jQuery.noop;
								delete xhrs[ handle ];
							}

							// If it's an abort
							if ( isAbort ) {

								// Abort it manually if needed
								if ( xhr.readyState !== 4 ) {
									xhr.abort();
								}
							} else {

								// Get info
								var status = xhr.status,
									statusText,
									response,
									responseHeaders = xhr.getAllResponseHeaders();

								try { // Firefox throws an exception when accessing statusText for faulty cross-domain requests

									statusText = xhr.statusText;

								} catch( e ) {

									statusText = ""; // We normalize with Webkit giving an empty statusText

								}

								// Filter status for non standard behaviours
								// (so many they seem to be the actual "standard")
								status =
									// Opera returns 0 when it should be 304
									// Webkit returns 0 for failing cross-domain no matter the real status
									status === 0 ?
										(
											! s.crossDomain || statusText ? // Webkit, Firefox: filter out faulty cross-domain requests
											(
												responseHeaders ? // Opera: filter out real aborts #6060
												304
												:
												0
											)
											:
											302 // We assume 302 but could be anything cross-domain related
										)
										:
										(
											status == 1223 ?	// IE sometimes returns 1223 when it should be 204 (see #1450)
												204
												:
												status
										);

								// Guess response & update dataType accordingly
								response =
									s.determineDataType(
										xhr.getResponseHeader("content-type"),
										xhr.responseText,
										xhr.responseXML );

								// Call complete
								complete(status,statusText,response,responseHeaders);
							}
						}
					};

					// if we're in sync mode
					// or it's in cache and has been retrieved directly (IE6 & IE7)
					// we need to manually fire the callback
					if ( ! s.async || xhr.readyState === 4 ) {

						callback();

					} else {

						// Add to list of active xhrs
						handle = xhrId++;
						xhrs[ handle ] = xhr;
						xhr.onreadystatechange = callback;
					}
				},

				abort: function() {
					if ( callback ) {
						callback(0,1);
					}
				}
			};
		}
	});
}

})( jQuery );
