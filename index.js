"use strict";
const Alexa = require('alexa-sdk');
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const states = {
    UPDATE: '_UPDATE'
};

const LedColorNameToKey = {
    'オフ': 0,
    '赤': 1,
    '緑': 2,
    '青': 4,
    '白': 7
};

const LedColorKeyToName = {
    0: 'オフ',
    1: '赤',
    2: '緑',
    4: '青',
    7: '白'
};

exports.handler = function(event, context, callback) {
    let alexa = Alexa.handler(event, context);
    alexa.appId = process.env.APP_ID;
    alexa.registerHandlers(handlers, updateHandlers);
    alexa.execute();
}

let handlers = {
    'LaunchRequest': function() {
        this.emit('AMAZON.HelpIntent');
    },
    'AMAZON.HelpIntent': function() {
        this.emit(':tell', 'デバイスのLEDを確認および変更します。' +
            'たとえば、デモデバイスの色を教えてと聞いてください。');
    },
    'LedColorIntent': function() {
        let handlers = this;
        const iotdata = new AWS.IotData({
            region: process.env.AWS_REGION,
            endpoint: process.env.IOT_ENDPOINT
        });
        const paramsGet = {
            thingName: process.env.IOT_THING_NAME
        };

        iotdata.getThingShadow(paramsGet).promise()
            .then(function(data) {
                const reportedLedColor = JSON.parse(data.payload).state.reported.ledColor;
                console.log("reported ledColor: " + reportedLedColor);
                handlers.handler.state = states.UPDATE;
                const message = 'LEDは' + LedColorKeyToName[reportedLedColor] + 'です。' +
                    'LEDの色を変更しますか。';
                const reprompt = 'LEDの色を変更しますか。';
                handlers.emit(':ask', message, reprompt);
                console.log(message);
            }).catch(function(err) {
                console.log(err, err.stack);
            });
    }
};

let updateHandlers = Alexa.CreateStateHandler(states.UPDATE, {
    'LedColorIntent': function() {
        let handlers = this;
        handlers.handler.state = '';
        handlers.attributes['STATE'] = undefined;

        const colorName = handlers.event.request.intent.slots.LedColor.value;
        const iotdata = new AWS.IotData({
            region: process.env.AWS_REGION,
            endpoint: process.env.IOT_ENDPOINT
        });
        const desired = {
            state: {
                desired: {
                    ledColor: LedColorNameToKey[colorName]
                }
            }
        };
        const paramsUpdate = {
            payload: JSON.stringify(desired),
            thingName: process.env.IOT_THING_NAME
        };

        iotdata.updateThingShadow(paramsUpdate).promise()
            .then(function(data) {
                console.log("desired ledColer: " + JSON.parse(data.payload).state.desired.ledColor);
                const message = 'はい';
                handlers.emit(':tell', message);
                console.log(message);
            }).catch(function(err) {
                console.log(err, err.stack);
            });
    },
    'Unhandled': function() {
        const reprompt = 'LEDの色を変更しますか。';
        this.emit(':ask', reprompt, reprompt);
    }
});