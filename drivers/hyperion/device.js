'use strict';

const Homey = require('homey');
let Hyperion = require('hyperion-client');

class Device extends Homey.Device {

    onInit () {
        this.log('onInit');
        this.setUnavailable();

        if (this.getCapabilityValue('dim') === null) this.setCapabilityValue('dim', 1);
        if (this.getCapabilityValue('light_hue') === null) this.setCapabilityValue('light_hue', 0);
        if (this.getCapabilityValue('light_saturation') === null) this.setCapabilityValue('light_saturation', 1);
        if (this.getCapabilityValue('hyperion_effect') === null) this.setCapabilityValue('hyperion_effect', 'none');

        this._registerCapabilities();
        this._connect();
    }

    onAdded () {
        this.log('onAdded');
    }

    onDeleted () {
        this.log('onDeleted');

        if (typeof this.hyperion.close === 'function') {
            this.hyperion.close();
            delete this.hyperion;
        }
    }

    onRenamed () {
        this.log('onAdded');
    }

    onSettings (oldSettingsObj, newSettingsObj, changedKeysArr) {
        this.log('onSettings', changedKeysArr);

        if (changedKeysArr.length)
            this._connect();

        return Promise.resolve();
    }

    _connect () {
        this.log('_connect');

        if (this.hyperion && typeof this.hyperion.close === 'function') {
            this.hyperion.close();
            delete this.hyperion;
        }

        const settings = this.getSettings();
        console.log(settings);

        this.hyperion = new Hyperion(settings.address, settings.port, settings.priority);
        this.serverInfo = {};

        this.hyperion.on('connect', () => {
            this.log('onConnect');

            this.hyperion.getServerinfo((err, result) => {
                if (err) {
                    return setTimeout(() => {
                        this._connect();
                    }, 10000);
                }

                this.serverInfo = result;
                this.setAvailable();
            });

        });

        this.hyperion.on('disconnect', () => {
            this.log('onDisconnect');
            this.setUnavailable('Offline');

            // try again every 10s
            setTimeout(() => {
                this._connect();
            }, 10000);
        });

        let initialConnect = true;

        this.hyperion.on('error', (err) => {
            this.error('onError', err);

            if (initialConnect) {
                initialConnect = false;

                // try again every 10s
                setTimeout(() => {
                    this._connect();
                }, 10000);
            }
        });
    }

    _registerCapabilities () {
        this.registerMultipleCapabilityListener([
            'onoff',
            'dim',
            'light_hue',
            'light_saturation',
        ], (valueObj, optsObj) => {
            this.log('onCapabilityListener', valueObj);

            if (Object.keys(valueObj).length === 1) {
                if (typeof valueObj.onoff === 'boolean' && !valueObj.onoff) {
                    return new Promise((resolve, reject) => {
                        this.hyperion.clearall((err, result) => {
                            if (err) {
                                return reject(err);
                            }

                            return resolve();
                        });
                    });
                }
            }

            let {
                dim = this.getCapabilityValue('dim'),
                light_hue = this.getCapabilityValue('light_hue'),
                light_saturation = this.getCapabilityValue('light_saturation'),
            } = valueObj;

            return new Promise((resolve, reject) => {
                const color = this.HSVtoRGB([ light_hue * 360, light_saturation * 100, dim * 100 ]);

                this.hyperion.setColor( color, (err, result) => {
                    if (err) {
                        return reject(err);
                    }

                    this.setCapabilityValue('onoff', true);
                    return resolve();
                });
            });
        }, 300);

        this.registerCapabilityListener('hyperion_effect', value => {
            this.log('hyperion_effect', value);

            if (value === 'none') {
                return new Promise((resolve, reject) => {
                    const color = this.HSVtoRGB([ this.getCapabilityValue('light_hue') * 360, this.getCapabilityValue('light_saturation') * 100, this.getCapabilityValue('dim') * 100 ]);
                    this.hyperion.setColor( color, (err, result) => {
                        if (err) {
                            return reject(err);
                        }

                        return resolve();
                    });
                });
            } else {
                if (this.serverInfo
                 && this.serverInfo.info
                 && this.serverInfo.info.effects ) {
                    return new Promise((resolve, reject) => {
                        this.serverInfo.info.effects.forEach((effect) => {
                            if (effect.name.toLowerCase() !== value.toLowerCase())
                                return;

                            this.hyperion.setEffect(effect.name, effect.args, (err, result) => {
                                if (err) {
                                    return reject(err);
                                }

                                this.setCapabilityValue('onoff', true);
                                return resolve();
                            });
                        });
                    });
                } else {
                    return Promis.reject('device_offline');
                }
            }
        });
    }

    HSVtoRGB(hsv) {
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

}

module.exports = Device;
