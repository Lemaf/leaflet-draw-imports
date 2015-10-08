!function(){L.drawLocal.draw.toolbar.imports||(L.drawLocal.draw.toolbar.imports={}),L.Draw.Imports=L.Draw.Feature.extend({statics:{FORMATS:[],TYPE:"imports"},initialize:function(t,e){this.type=L.Draw.Imports.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},getActions:function(){return L.Draw.Imports.FORMATS.map(function(t){var e=null;return t.createActionElement&&(e=t.createActionElement.call(this)),{enabled:!0,title:t.title,text:t.text,callback:t.callback,context:this,ownElement:e}},this)}})}(),function(){L.drawLocal.draw.toolbar.imports.shapeZip||(L.drawLocal.draw.toolbar.imports.shapeZip={text:"Import a shapefile zip",title:"Please, select a zip file."}),ShpZipFormat={_handlers:{},_nextId:1,createOpenButton:function(){var t=L.DomUtil.create("a");t.style.position="relative",t.innerHTML=L.drawLocal.draw.toolbar.imports.shapeZip.text,t.title=L.drawLocal.draw.toolbar.imports.shapeZip.title;var e=L.DomUtil.create("input","leaflet-draw-draw-imports-action",t);e.type="file";var i=this;return e.onchange=function(){ShpZipFormat._openShapeZip(i,e)},t},nop:function(){},_getWorker:function(){if(!this._worker){if(!L.Draw.Imports.SHPJS_URL)throw new Error("Need shapefile-js URL");var t="try { importScripts('"+L.Draw.Imports.SHPJS_URL+"'); } catch (e) {console.error(e); throw e;}\nonmessage = function(e) {\nconsole.log('Processing ShapeZip...');\nvar geoJSON = shp.parseZip(e.data.byteArray);\nconsole.log('ShapeZip processed!');\npostMessage({id: e.data.id, geoJSON: geoJSON});\n}",e=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));this._worker=new Worker(e),this._worker.onmessage=this._onmessage.bind(this),this._worker.onerror=function(){console.log(arguments)}}return this._worker},_onmessage:function(t){var e,i,r,a,n,o=t.data.geoJSON,s=this._handlers[t.data.id];o.features.forEach(function(t){if(e=t.properties,i=t.geometry,i.type.startsWith("Multi"))for(a=0;a<i.coordinates.length;a++)r={type:i.type.substring(5),properties:e,coordinates:i.coordinates[a]},n=L.GeoJSON.geometryToLayer(r),s._fireCreatedEvent(n);else n=L.GeoJSON.geometryToLayer(t),s._fireCreatedEvent(n);s.disable()})},_openShapeZip:function(t,e){if(e.files||e.files[0]){var i=new FileReader;i.onload=function(){2===i.readyState&&i.result&&ShpZipFormat._parse(t,i.result)},t._map.fire("draw:importstart"),i.readAsArrayBuffer(e.files[0])}},_parse:function(t,e){var i=this._getWorker(),r=this._nextId++;this._handlers[r]=t,i.postMessage({id:r,byteArray:e},[e])}},L.Draw.Imports.FORMATS.push({callback:ShpZipFormat.nop,createActionElement:ShpZipFormat.createOpenButton})}(),function(){L.FeatureGroup.Edit=L.Handler.extend({initialize:function(t){this._layer=t},addHooks:function(){this._layer.eachLayer(this._enableEditing,this),this._layer.on("layeradd",this._enableEditing,this),this._layer.on("layerremove",this._disableEditing,this)},removeHooks:function(){this._layer.eachLayer(this._disableEditing,this),this._layer.off("layeradd",this._enableEditing,this),this._layer.off("layerremove",this._disableEditing,this)},_enableEditing:function(t){t.editing&&t.editing.enable()},_disableEditing:function(t){t.editing&&t.editing.disable()}}),L.FeatureGroup.addInitHook(function(){this.editing||(this.editing=new L.FeatureGroup.Edit(this))})}(),L.FeatureGroup.include({isEmpty:function(){for(var t in this._layers)return!1;return!0}}),function(){var t="within";L.FeatureGroup.Validation=L.Handler.extend({includes:L.Mixin.Events,options:{},initialize:function(t){this._featureGroup=t,this._binded={},this._errors={}},addHooks:function(){this._withins&&(this._withins.forEach(this._watch.bind(this,t)),this._featureGroup.on("layeradd layerremove",this._getHandler(this._validateTarget,t)))},fireOnMap:function(t,e){this._featureGroup._map&&this._featureGroup._map.fire(t,e)},removeHooks:function(){this._withins&&(this._featureGroup.off("layeradd layerremove",this._getHandler(this._validateTarget,t)),this._unwithin())},within:function(){return this._unwithin(),this._withins=Array.prototype.slice.call(arguments,0),this},_getHandler:function(t,e){var i=L.stamp(t);return this._binded[e]||(this._binded[e]={}),this._binded[e][i]||(this._binded[e][i]=t.bind(this,e)),this._binded[e][i]},_validateSource:function(t,e){if(!this._featureGroup.isEmpty()){var i=L.stamp(e.target);if(this._featureGroup[t](e.target)){if(this._errors[t]){var r=this._errors[t].indexOf(i);r>-1&&(this._errors[t].splice(r,1),0===this._errors[t].length&&(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)))}}else this._errors[t]||(this._errors[t]=[]),-1===this._errors[t].indexOf(i)&&this._errors[t].push(i),e={validation:t,targetLayer:this._featureGroup,sourceLayer:e.target},this.fire("invalid",e),this.fireOnMap("draw:invalid",e)}},_validateTarget:function(t){var e,i=!0;if(this._errors[t]&&this._errors[t].length&&(i=!1),this._errors[t]=[],this._featureGroup.isEmpty())return void(i||(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)));var r=this["_"+t+"s"];r&&(e={validation:t,targetLayer:this._featureGroup},r.forEach(function(i){this._featureGroup[t](i)||(this._errors[t].push(L.stamp(i)),e.sourceLayer=i,this.fire("invalid",e),this.fireOnMap("draw:invalid",e))},this),this._errors[t].length||i||(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)))},_onLayerPreAdd:function(t,e){},_onLayerRemove:function(t,e){},_onLayerPreRemove:function(t,e){},_unwithin:function(){this._withins&&(this._withins.forEach(this._unwatch.bind(this,t)),delete this._withins)},_unwatch:function(t,e){var i=this._getHandler(this._validateSource,t);e.off("layeradd",i),e.off("layerremove",i)},_watch:function(t,e){var i=this._getHandler(this._validateSource,t);e.on("layeradd",i),e.on("layerremove",i)}}),L.FeatureGroup.addInitHook(function(){this.validation||(this.validation=new L.FeatureGroup.Validation(this))})}();