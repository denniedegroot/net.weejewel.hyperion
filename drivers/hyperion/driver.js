"use strict";

var Hyperion = require('hyperion-client');

var self = module.exports;

var devices = {};

self.init = function( devices_data, callback ){
		
	devices_data.forEach(initDevice);
	
	Homey.manager('flow').on('action.effect', function( callback, args ){
		
		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );
		
		device.hyperion.setEffect( args.effect.name, args.effect.args, function( err, result ){
			if( err ) return callback( err );
			return callback( null, result.success );
		});
	});
	
	Homey.manager('flow').on('action.effect.effect.autocomplete', function( callback, args ){

		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );
		
		device.hyperion.getServerinfo(function( err, result ){
			if( err ) return callback( err );
			
			if( !(result.info && result.info.effects) ) return callback( new Error("Could not get effects.") );
			
			var effects = [];
			result.info.effects.forEach(function(effect){
				
				if( effect.name.toLowerCase().indexOf( args.query.toLowerCase() ) < 0 ) return;
				
				effects.push({
					name: effect.name,
					args: effect.args
				});
			});
						
			return callback( null, effects );
		});
	});
	
	Homey.manager('flow').on('action.color', function( callback, args ){
		
		var device = getDeviceByData( args.device );
		if( device instanceof Error ) return callback( device );
				
		var color = hexToRgb(args.color);
			color = [ color.r, color.g, color.b ];
		
		device.hyperion.setColor( color, function( err, result ){
			if( err ) return callback( err );
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
			state 		: {},
			data 		: device_data,
			hyperion	: new Hyperion( settings.address, settings.port, settings.priority )
		}
		
		device.hyperion.on('connect', function(){
			Homey.log('onConnect', device_data.id);
			self.setAvailable( device_data );
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