'use strict';

const Homey = require('homey');
let Hyperion = require('hyperion-client');

class Driver extends Homey.Driver {

    onInit () {
        this.log('onInit');

        new Homey.FlowCardAction('effect')
            .register()
            .registerRunListener((args, state) => {
                return args.device.triggerCapabilityListener('hyperion_effect', args.effect.name).then(() => {
                    return args.device.setCapabilityValue('hyperion_effect', args.effect.name);
                });
            })
            .getArgument('effect')
            .registerAutocompleteListener((query, args) => {
                let effects = [];

                args.device.serverInfo.info.effects.forEach((effect) => {
                    if (effect.name.toLowerCase().indexOf(query.toLowerCase() ) < 0)
                        return;

                    effects.push({
                        name: effect.name
                    });
                });

                return Promise.resolve(effects);
            });

        new Homey.FlowCardAction('clear')
            .register()
            .registerRunListener((args, state) => {
                return new Promise((resolve, reject) => {
                    args.device.hyperion.clear((error, result) => {
                        if (error)
                            return reject(error);

                        resolve();
                    });
                });
            });

        new Homey.FlowCardAction('clearall')
            .register()
            .registerRunListener((args, state) => {
                return new Promise((resolve, reject) => {
                    return args.device.hyperion.clearall((error, result) => {
                        if (error)
                            return reject(error);

                        resolve();
                    });
                });
            });
    }

    onPair (socket) {
        socket.on('validate', (data, callback) => {
            this.log('onPair validate', data);

            const address     = data.address;
            const port        = parseInt(data.port);
            const priority    = 1;
            const hyperion = new Hyperion(address, port, priority);

            hyperion.on('connect', () => {
                hyperion.getServerinfo((err, result) => {
                    if(err)
                        return callback( err );

                    callback( null, {
                        hostname    : result.info.hostname,
                        settings    : {
                            address     : address,
                            port        : port,
                            priority    : priority
                        }
                    });
                })
            });

            hyperion.on('error', function(error){
                callback( error, null );
            });
        });
    }

}

module.exports = Driver;
