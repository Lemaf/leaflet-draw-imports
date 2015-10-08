!function(){L.drawLocal.draw.toolbar.imports||(L.drawLocal.draw.toolbar.imports={}),L.Draw.Imports=L.Draw.Feature.extend({statics:{FORMATS:[],TYPE:"imports"},initialize:function(t,e){this.type=L.Draw.Imports.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},getActions:function(){return L.Draw.Imports.FORMATS.map(function(t){var e=null;return t.createActionElement&&(e=t.createActionElement.call(this)),{enabled:!0,title:t.title,text:t.text,callback:t.callback,context:this,ownElement:e}},this)}})}(),function(){L.drawLocal.draw.toolbar.imports.shapeZip||(L.drawLocal.draw.toolbar.imports.shapeZip={text:"Import a shapefile zip",title:"Please, select a zip file."}),ShpZipFormat={_handlers:{},_nextId:1,createOpenButton:function(){var t=L.DomUtil.create("a");t.style.position="relative",t.innerHTML=L.drawLocal.draw.toolbar.imports.shapeZip.text,t.title=L.drawLocal.draw.toolbar.imports.shapeZip.title;var e=L.DomUtil.create("input","leaflet-draw-draw-imports-action",t);e.type="file";var i=this;return e.onchange=function(){ShpZipFormat._openShapeZip(i,e)},t},nop:function(){},_getWorker:function(){if(!this._worker){if(!L.Draw.Imports.SHPJS_URL)throw new Error("Need shapefile-js URL");var t="try { importScripts('"+L.Draw.Imports.SHPJS_URL+"'); } catch (e) {console.error(e); throw e;}\nonmessage = function(e) {\nconsole.log('Processing ShapeZip...');\nvar geoJSON = shp.parseZip(e.data.byteArray);\nconsole.log('ShapeZip processed!');\npostMessage({id: e.data.id, geoJSON: geoJSON});\n}",e=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));this._worker=new Worker(e),this._worker.onmessage=this._onmessage.bind(this),this._worker.onerror=function(){console.log(arguments)}}return this._worker},_onmessage:function(t){var e,i,r,a,n,s=t.data.geoJSON,o=this._handlers[t.data.id];s.features.forEach(function(t){if(e=t.properties,i=t.geometry,i.type.startsWith("Multi"))for(a=0;a<i.coordinates.length;a++)r={type:i.type.substring(5),properties:e,coordinates:i.coordinates[a]},n=L.GeoJSON.geometryToLayer(r),o._fireCreatedEvent(n);else n=L.GeoJSON.geometryToLayer(t),o._fireCreatedEvent(n);o.disable()})},_openShapeZip:function(t,e){if(e.files||e.files[0]){var i=new FileReader;i.onload=function(){2===i.readyState&&i.result&&ShpZipFormat._parse(t,i.result)},t._map.fire("draw:importstart"),i.readAsArrayBuffer(e.files[0])}},_parse:function(t,e){var i=this._getWorker(),r=this._nextId++;this._handlers[r]=t,i.postMessage({id:r,byteArray:e},[e])}},L.Draw.Imports.FORMATS.push({callback:ShpZipFormat.nop,createActionElement:ShpZipFormat.createOpenButton})}(),function(){L.FeatureGroup.Edit=L.Handler.extend({initialize:function(t){this._layer=t},addHooks:function(){this._layer.eachLayer(this._enableEditing,this),this._layer.on("layeradd",this._enableEditing,this),this._layer.on("layerremove",this._disableEditing,this)},removeHooks:function(){this._layer.eachLayer(this._disableEditing,this),this._layer.off("layeradd",this._enableEditing,this),this._layer.off("layerremove",this._disableEditing,this)},_disableEditing:function(t){t.editing&&(t.editing.disable(),t.off("edit",this._onLayerEdit,this))},_enableEditing:function(t){t.editing&&(t.editing.enable(),t.on("edit",this._onLayerEdit,this))},_onLayerEdit:function(t){this._layer.fire("edit",{layer:t.layer||t.target})}}),L.FeatureGroup.addInitHook(function(){this.editing||(this.editing=new L.FeatureGroup.Edit(this))})}(),L.FeatureGroup.include({count:function(){var t=0;for(var e in this._layers)this._layers[e].count?t+=this._layers[e].count():t++;return t}}),L.FeatureGroup.include({isEmpty:function(){var t=!0,e=!0;for(var i in this._layers)if(t=!1,this._layers[i].isEmpty){if(!this._layers[i].isEmpty())return!1}else e=!1;return t||e}}),L.FeatureGroup.include({setLatLngs:function(t){var e,i=this.count();if(1!==i)throw i?new Error("Ambigous setLatLngs"):new Error("Empty layer!");for(var r in this._layers){if(e=this._layers[r],!e.setLatLngs)throw new Error("L.FeatureGroup doesn't have a layer with setLatLngs");e.setLatLngs(t)}}}),function(){var t={within:{check:"intersects",fix:["intersection"]}},e={within:"within"};L.FeatureGroup.Fixer=L.Class.extend({initialize:function(t){this._validation=t},within:function(){var i=this;setTimeout(function(){var r=i._validation.isValid(e.within);r||i._fix(e.within,t.within)})},_fix:function(t,e){if(e){var i=e.check,r=e.fix;this._validation.wait(t,function(){function e(t,e){if(restrictionGeometry=e.jsts.geometry(),t[i](restrictionGeometry))for(n=0;n<r.length;n++)s=r[n],t=t[s](restrictionGeometry);return t}var a,n,s,o,h=this._validation.getFeatureGroup(),l=this._validation.getRestrictionLayers(t);h.eachLayer(function(t){a=l.reduce(e,t.jsts.geometry()),a&&a!==t&&(t.editing?(o=t.editing.enabled(),t.editing.disable()):o=!1,t.setLatLngs(L.jsts.jstsToLatLngs(a)),o&&t.editing.enable())})},this)}}})}(),function(){var t={Within:"within"};L.FeatureGroup.Validation=L.Handler.extend({includes:L.Mixin.Events,options:{},initialize:function(t){this._featureGroup=t,this._binded={},this._errors={}},addHooks:function(){var e,i,r;for(var a in t)r=t[a],e=this._collectionId(r),i=this[e],i&&i.forEach(this._watch.bind(this,r)),this._watchMe(r)},getRestrictionLayers:function(t){var e=this._collectionId(t);return this[e]?this[e].slice(0):void 0},getFeatureGroup:function(){return this._featureGroup},isValid:function(t){return t&&this._errors[t]?!this._errors[t].length:void 0},fireOnMap:function(t,e){this._featureGroup._map&&this._featureGroup._map.fire(t,e)},removeHooks:function(){var e,i,r;for(var a in t)r=t[a],e=this._collectionId(r),i=this[e],i&&i.forEach(this._unwatch.bind(this,r)),this._unwatchMe(r)},wait:function(t,e,i){var r=this._collectionId(t);if(this[r])try{return this[r].forEach(this._unwatch.bind(this,t)),this._unwatchMe(t),e.call(i,this)}finally{this.enabled()&&(this[r].forEach(this._watch.bind(this,t)),this._watchMe(t))}},within:function(){return this._on(t.Within,Array.prototype.slice.call(arguments,0)),this},_collectionId:function(t){return t?"_"+t+"s":null},_getHandler:function(t,e){var i=L.stamp(t);return this._binded[e]||(this._binded[e]={}),this._binded[e][i]||(this._binded[e][i]=t.bind(this,e)),this._binded[e][i]},_off:function(t){var e=this._collectionId(t);this[e]&&(this[e].forEach(this._unwatch.bind(this,t)),delete this[e])},_on:function(t,e){this._off(t),this[this._collectionId(t)]=e},_validateFeature:function(t,e){this._featureGroup.jsts.clean(),this._validateTarget(t)},_validateRestriction:function(t,e){if(!this._featureGroup.isEmpty()){var i=L.stamp(e.target);if(this._featureGroup.jsts[t](e.target)){if(this._errors[t]){var r=this._errors[t].indexOf(i);r>-1&&(this._errors[t].splice(r,1),0===this._errors[t].length&&(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)))}}else this._errors[t]||(this._errors[t]=[]),-1===this._errors[t].indexOf(i)&&this._errors[t].push(i),e={validation:t,targetLayer:this._featureGroup,restrictionLayer:e.target},this.fire("invalid",e),this.fireOnMap("draw:invalid",e)}},_validateRestrictionFeature:function(t,e){var i,r,a=this._collectionId(t);if(i=this[a])for(var n=0;n<i.length;n++)if(i[n].hasLayer(e.target)){(r=i[n]).jsts.clean();break}r&&this._validateRestriction(t,{target:r})},_validateTarget:function(t){var e,i=!0;if(this._errors[t]&&this._errors[t].length&&(i=!1),this._errors[t]=[],this._featureGroup.isEmpty())return void(i||(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)));var r=this[this._collectionId(t)],a=this._featureGroup.jsts[t];r&&(e={validation:t,targetLayer:this._featureGroup},r.forEach(function(i){a.call(this._featureGroup.jsts,i)||(this._errors[t].push(L.stamp(i)),e.restrictionLayer=i,this.fire("invalid",e),this.fireOnMap("draw:invalid",e))},this),this._errors[t].length||i||(e={validation:t,targetLayer:this._featureGroup},this.fire("valid",e),this.fireOnMap("draw:valid",e)))},_unwatch:function(t,e){var i=this._getHandler(this._validateRestriction,t);e.off("layeradd",i),e.off("layerremove",i),e.off("layeradd",this._getHandler(this._watchRestrictionFeature,t)),e.eachLayer(function(e){e.editing&&e.off("edit",this._getHandler(this._validateRestrictionFeature,t))},this)},_unwatchMe:function(t){this._featureGroup.eachLayer(function(e){e.editing&&e.off("edit",this._getHandler(this._validateFeature,t))},this),this._featureGroup.off("layeradd",this._getHandler(this._watchFeature,t)),this._featureGroup.off("layeradd layerremove",this._getHandler(this._validateTarget,t))},_watch:function(t,e){var i=this._getHandler(this._validateRestriction,t);e.eachLayer(function(e){this._watchRestrictionFeature(t,{layer:e})},this),e.on("layeradd",this._getHandler(this._watchRestrictionFeature,t)),e.on("layeradd",i),e.on("layerremove",i)},_watchFeature:function(t,e){e.layer.editing&&e.layer.on("edit",this._getHandler(this._validateFeature,t))},_watchMe:function(t){this._featureGroup.eachLayer(function(e){this._watchFeature(t,{layer:e})},this),this._featureGroup.on("layeradd",this._getHandler(this._watchFeature,t)),this._featureGroup.on("layeradd layerremove",this._getHandler(this._validateTarget,t))},_watchRestrictionFeature:function(t,e){e.layer.editing&&e.layer.on("edit",this._getHandler(this._validateRestrictionFeature,t))}}),L.FeatureGroup.addInitHook(function(){this.validation||(this.validation=new L.FeatureGroup.Validation(this)),this.fix||(this.fix=new L.FeatureGroup.Fixer(this.validation))})}();