const avilableServices = {};
const { nanoid } = require('nanoid');

class Reshuffle {
  constructor() {
    this.servicesIdToServices = {};
    this.eventIdsToHandlers = {};
    this.shareResources = {};
    this.httpDelegetes = {};
    this.webserverStarted = false;
    this.port =8000;
    console.log("Initiating Reshuffle");

  }
  
  use(service, service_id) {
    service.app = this;
    if(service_id){
      service.id = service_id;
    }
    this.servicesIdToServices[service.id] = service;
     
  }

  unuse(service,) {
    service.stop()
    delete this.servicesIdToServices[service.id];
  }

  getService(serviceId) {
    return this.servicesIdToServices[serviceId];
  }

  // eslint-disable-next-line no-unused-vars
  unregisterHTTPDelegate(path, delegate) {
    delete this.httpDelegetes[path];
  }
  registerHTTPDelegate(path, delegate) {
    if (!this.shareResources.webserver) {
      var express = require('express');
      this.shareResources.webserver = express();
      this.shareResources.webserver.route("*")
        .all((function (req, res, next) {
          let handled = false;
          if (this.httpDelegetes[req.url]) {
            handled = this.httpDelegetes[req.url].handle(req, res, next);
          }
          if(!handled) {
            res.end("no handler");
          }
        }).bind(this));
    }
    this.httpDelegetes[path] = delegate;
  }

  when(eventConsiguration, handler) {
    let handlerWrapper = handler;
    if (!handler.id) {
      handlerWrapper = {
        "handle": handler,
        "id": nanoid()
      };
    }
    if (this.eventIdsToHandlers[eventConsiguration.id]) {
      this.eventIdsToHandlers[eventConsiguration.id].push(handlerWrapper);
    }
    else {
      this.eventIdsToHandlers[eventConsiguration.id] = [handlerWrapper];
    }
    console.log("Registering event " + eventConsiguration.id);
  }

  start(port, callback) {
    if(port) this.port = port;
    
    for (const serviceIndex in this.servicesIdToServices) {
      let service = this.servicesIdToServices[serviceIndex];
      if(!service.started){
        service.start(this);
        service.started = true;
      }
    }

    if (this.shareResources.webserver && !this.webserverStarted){
      this.shareResources.webserver.listen(this.port ,() => {
        this.webserverStarted = true;
     });
    }
    if (callback) callback();
  }

  restart(port) {
    this.start(port, () => { console.log("Refreshing server config")});
  }
  
  handleEvent(eventName, event) {
    if (event == null) {
      event = {};
    }
    event.getService = this.getService.bind(this);
    let eventHandlers = this.eventIdsToHandlers[eventName];
    if(eventHandlers.length == 0){
      return false;
    }
    for (let index = 0; index < eventHandlers.length; index++) {
      const handler = eventHandlers[index];
      this._p_handle(handler, event);
    }
    return true;
  }
  _p_handle(handler, event) {
    handler.handle(event);
  }
}

module.exports = {
  Reshuffle: Reshuffle,
};


// register our out of the box Service Connectors and Event Emmiters
avilableServices["CronService"] = module.exports.CronService = require('./lib/cron').CronService
avilableServices["HttpService"] = module.exports.HttpService = require('./lib/http').HttpService
avilableServices["SlackService"] = module.exports.SlackService = require('./lib/slack').SlackService

module.exports.EventConfiguration = require('./lib/eventConfiguration').EventConfiguration;
Reshuffle.prototype.avilableServices = avilableServices;