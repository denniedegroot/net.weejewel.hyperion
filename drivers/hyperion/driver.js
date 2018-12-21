"use strict";

var Hyperion = require('hyperion-client');

var self = module.exports;

var devices = {};

self.init = function( devices_data, callback ){

	devices_data.forEach(initDevice);

	Homey.manager('flow').on('action.effect', function( callback, args ){
		self.capabilities.hyperion_effect.set( args.device, args.effect.name, function( err, result ){
			if( err ) return callback( err );
			return callback( null, true );
		});
	});

	Homey.manager('flow').on('action.effect.effect.autocomplete', function( callback, data ){

		var device = getDeviceByData( data.args.device.data );
		if( device instanceof Error ) return callback( device );

		var effects = [];
		device.serverInfo.info.effects.forEach(function(effect){

			if( effect.name.toLowerCase().indexOf( data.query.toLowerCase() ) < 0 ) return;

			effects.push({
				name: effect.name
			});
		});

		return callback( null, effects );
	});

	Homey.manager('flow').on('action.color', function( callback, args ){

		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );

		var colorRgb = hexToRgb(args.color);

		device.hyperion.setColor([ colorRgb.r, colorRgb.g, colorRgb.b ], function( err, result ){
			if( err ) return callback( err );

			var colorHsv = rgb2hsv( colorRgb.r, colorRgb.g, colorRgb.b );

			device.state['light_hue'] = colorHsv.h / 360;
			self.realtime( args.device, 'light_hue', device.state['light_hue']);

			device.state['light_saturation'] = colorHsv.s / 100;
			self.realtime( args.device, 'light_saturation', device.state['light_saturation']);

			return callback( null, result.success );
		});
	});

	Homey.manager('flow').on('action.clear', function( callback, args ){

		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );

		device.hyperion.clear(function( err, result ){
			if( err ) return callback( err );
			return callback( null, result.success );
		});
	});

	Homey.manager('flow').on('action.clearall', function( callback, args ){

		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );

		device.hyperion.clearall(function( err, result ){
			if( err ) return callback( err );
			return callback( null, result.success );
		});
	});

	callback();
}

self.capabilities = {};
self.capabilities.onoff = {};
self.capabilities.onoff.get = function( device_data, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	return callback( null, device.state['onoff'] );
}
self.capabilities.onoff.set = function( device_data, value, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	if( value === true ) {
		var color = HSVtoRGB([ device.state['light_hue'] * 360, device.state['light_saturation'] * 100, device.state['dim'] * 100 ]);
		device.hyperion.setColor( color, function( err, result ){
			if( err ) return callback( err );

			device.state['onoff'] = value;
			return callback( null, value );
		});
	} else {
		device.hyperion.clearall(function( err, result ){
			if( err ) return callback( err );

			device.state['onoff'] = value;
			return callback( null, value );
		});
	}

}
self.capabilities.dim = {};
self.capabilities.dim.get = function( device_data, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	return callback( null, device.state['dim'] );
}
self.capabilities.dim.set = function( device_data, value, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	var color = HSVtoRGB([ device.state['light_hue'] * 360, device.state['light_saturation'] * 100, value * 100 ]);
	device.hyperion.setColor( color, function( err, result ){
		if( err ) return callback( err );

		device.state['dim'] = value;
		return callback( null, device.state['dim'] );
	});
}
self.capabilities.light_hue = {};
self.capabilities.light_hue.get = function( device_data, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	return callback( null, device.state['light_hue'] );
}
self.capabilities.light_hue.set = function( device_data, value, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	var color = HSVtoRGB([ value*360, device.state['light_saturation'] * 100, device.state['dim'] * 100 ]);
	device.hyperion.setColor( color, function( err, result ){
		if( err ) return callback( err );

		device.state['light_hue'] = value;
		return callback( null, device.state['light_hue'] );
	});
}
self.capabilities.light_saturation = {};
self.capabilities.light_saturation.get = function( device_data, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	return callback( null, device.state['light_saturation'] );
}
self.capabilities.light_saturation.set = function( device_data, value, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	var color = HSVtoRGB([ device.state['light_hue'] * 360, value * 100, device.state['dim'] * 100 ]);
	device.hyperion.setColor( color, function( err, result ){
		if( err ) return callback( err );

		device.state['light_saturation'] = value;
		return callback( null, device.state['light_saturation'] );
	});
}
self.capabilities.hyperion_effect = {};
self.capabilities.hyperion_effect.get = function( device_data, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	return callback( null, device.state['hyperion_effect'] );
}
self.capabilities.hyperion_effect.set = function( device_data, value, callback ) {
	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	if( value === 'none' ) {

		var color = HSVtoRGB([ device.state['light_hue'] * 360, device.state['light_saturation'] * 100, device.state['dim'] * 100 ]);
		device.hyperion.setColor( color, function( err, result ){
			if( err ) return callback( err );

			device.state['hyperion_effect'] = value;
			self.realtime( device_data, 'hyperion_effect', device.state['hyperion_effect']);
			return callback( null, device.state['hyperion_effect'] );
		});

	} else {
		
		if( device.serverInfo
		 && device.serverInfo.info
		 && device.serverInfo.info.effects ) {
			device.serverInfo.info.effects.forEach(function(effect){

				if( effect.name.toLowerCase() !== value.toLowerCase() ) return;

				device.hyperion.setEffect( effect.name, effect.args, function( err, result ){
					if( err ) return callback( err );
					device.state['hyperion_effect'] = value;
					self.realtime( device_data, 'hyperion_effect', device.state['hyperion_effect']);
					return callback( null, device.state['hyperion_effect'] );
				});
			});
		} else {
			return callback( new Error('device_offline') );
		}		

	}


}


self.pair = function( socket ) {

	// validate that the server works
	socket.on('validate', function( data, callback ){
		Homey.log('validate', data);

		var address 	= data.address;
		var port		= parseInt(data.port);
		var priority	= 1;

		var hyperion = new Hyperion( address, port, priority );
			hyperion.on('connect', function(){

				hyperion.getServerinfo(function( err, result ){
					if( err ) return callback( err );
					callback( null, {
						hostname	: result.info.hostname,
						settings	: {
							address		: address,
							port		: port,
							priority	: priority
						}
					});
				})

			})
			hyperion.on('error', function(error){
				callback( error, null );
			})

	})

	socket.on('add_device', function( device_data, callback ){
		initDevice( device_data );
		callback( null, true );
	});

}

self.settings = function( device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback ) {

	// validate if this connection works
	var hyperion = new Hyperion( newSettingsObj.address, newSettingsObj.port, newSettingsObj.priority );
		hyperion.on('connect', function(){
			callback( null, true );
			initDevice( device_data );
		});
		hyperion.on('error', function(err){
			callback( err, null );
		});

}

self.deleted = function( device_data, callback ) {

	var device = getDeviceByData( device_data );
	if( device instanceof Error ) return callback( device );

	if( typeof device.hyperion.close == 'function' ) {
		device.hyperion.close();
	}

	delete devices[ device_data.id ];
}

/*
	Helper functions
*/
function initDevice( device_data ) {

	self.getSettings( device_data, function( err, settings ){
		if( err ) return Homey.error(err);

		var device = devices[ device_data.id ] = {
			state 		: {
				onoff				: false,
				dim					: 1,
				light_hue			: 0,
				light_saturation	: 1,
				hyperion_effect		: 'none'
			},
			data 		: device_data,
			hyperion	: new Hyperion( settings.address, settings.port, settings.priority ),
			serverInfo	: {}
		}

		device.hyperion.on('connect', function(){
			Homey.log('onConnect', device_data.id);

			device.hyperion.getServerinfo(function( err, result ){
				if( err ) return setTimeout(function(){
					initDevice( device_data );
				}, 10000);

				device.serverInfo = result;

				self.setAvailable( device_data );

			});

		})

		device.hyperion.on('disconnect', function(){
			Homey.log('onDisconnect', device_data.id);
			self.setUnavailable( device_data, "Offline" );

			// try again every 10s
			setTimeout(function(){
				initDevice( device_data );
			}, 10000);
		})

		var initialConnect = true;
		device.hyperion.on('error', function(err){
			Homey.error('onError', err);

			if( initialConnect ) {
				initialConnect = false;

				// try again every 10s
				setTimeout(function(){
					initDevice( device_data );
				}, 10000);
			}

		})

		self.setUnavailable( device_data, "Offline" );
	});
}

function getDeviceByData( device_data ) {

	if( !(typeof device_data == 'object' && device_data.id) ) return new Error("invalid_device_data");

	var device = devices[ device_data.id ];
	if( typeof device == 'undefined' ) return new Error("invalid_device");

	return device;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function HSVtoRGB (hsv) {
    // this doesn't work for the values of 0 and 360
    // here's the hacky fix
    var h = hsv[0];
    if (h === 0) h = 1;
    if (h === 360) h = 359;
    // Rebase the h,s,v values
    h = h/360;
    var s = hsv[1]/100
    ,   v = hsv[2]/100
    ,   h_i = Math.floor(h*6)
    ,   f = h * 6 - h_i
    ,   p = v * (1 - s)
    ,   q = v * (1 - f*s)
    ,   t = v * (1 - (1 - f)*s)
    ,   r = 256
    ,   g = 256
    ,   b = 256
    ;

    switch(h_i) {
        case 0: r = v, g = t, b = p;  break;
        case 1: r = q, g = v, b = p;  break;
        case 2: r = p, g = v, b = t;  break;
        case 3: r = p, g = q, b = v;  break;
        case 4: r = t, g = p, b = v;  break;
        case 5: r = v, g = p, b = q;  break;
    }
    return [Math.floor(r*255), Math.floor(g*255), Math.floor(b*255)];
}

function rgb2hsv () {
    var rr, gg, bb,
        r = arguments[0] / 255,
        g = arguments[1] / 255,
        b = arguments[2] / 255,
        h, s,
        v = Math.max(r, g, b),
        diff = v - Math.min(r, g, b),
        diffc = function(c){
            return (v - c) / 6 / diff + 1 / 2;
        };

    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(r);
        gg = diffc(g);
        bb = diffc(b);

        if (r === v) {
            h = bb - gg;
        }else if (g === v) {
            h = (1 / 3) + rr - bb;
        }else if (b === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        }else if (h > 1) {
            h -= 1;
        }
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}
