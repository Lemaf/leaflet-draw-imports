;(function() {

	if (!L.drawLocal.draw.toolbar.imports)
		L.drawLocal.draw.toolbar.imports = {};

	L.Draw.Imports = L.Draw.Feature.extend({
		statics: {
			FORMATS: [],
			TYPE: 'imports'
		},

		initialize: function (map, options) {
			this.type = L.Draw.Imports.TYPE;

			L.Draw.Feature.prototype.initialize.call(this, map, options);
		},

		getActions: function () {

			return L.Draw.Imports.FORMATS.map(function(format) {
				var ownElement = null;

				if (format.createActionElement)
					ownElement = format.createActionElement.call(this);

				return {
					enabled: true,
					title: format.title,
					text: format.text,
					callback: format.callback,
					context: this,
					ownElement: ownElement
				};
			}, this);
		}
	});

})();
;(function() {

	if (!L.drawLocal.draw.toolbar.imports.shapeZip) {
		L.drawLocal.draw.toolbar.imports.shapeZip = {
			text: 'Import a shapefile zip',
			title: 'Please, select a zip file.'
		};
	}

	ShpZipFormat = {

		_handlers: {},

		_nextId: 1,

		createOpenButton: function() {
			var link = L.DomUtil.create('a');

			link.style.position = 'relative';
			link.innerHTML = L.drawLocal.draw.toolbar.imports.shapeZip.text;
			link.title = L.drawLocal.draw.toolbar.imports.shapeZip.title;

			var input = L.DomUtil.create('input', 'leaflet-draw-draw-imports-action', link);
			input.type = 'file';

			var handler = this;

			input.onchange = function() {
				ShpZipFormat._openShapeZip(handler, input);
			};

			return link;
		},

		nop: function() {},

		_getWorker: function() {
			if (!this._worker) {
				if (L.Draw.Imports.SHPJS_URL) {

					// No external .js script
					var script = "try { importScripts('" + L.Draw.Imports.SHPJS_URL + "'); } catch (e) {console.error(e); throw e;}\n" +
					"onmessage = function(e) {\n" +
						"console.log('Processing ShapeZip...');\n" +
						"var geoJSON = shp.parseZip(e.data.byteArray);\n" +
						"console.log('ShapeZip processed!');\n" +
						"postMessage({id: e.data.id, geoJSON: geoJSON});\n" +
					"}";

					var urlData = URL.createObjectURL(new Blob([script], {type: "application/javascript"}));
					this._worker = new Worker(urlData);

					this._worker.onmessage = this._onmessage.bind(this);
					this._worker.onerror = function() {
						console.log(arguments);
					};
				} else
					throw new Error('Need shapefile-js URL');
			}

			return this._worker;
		},

		_onmessage: function(e) {
			var geoJSON = e.data.geoJSON;
			var handler = this._handlers[e.data.id];

			// TODO: Is it always FeatureCollection?
			
			var properties, geometry, newFeature, i, layer;

			geoJSON.features.forEach(function(feature) {
				properties = feature.properties;
				geometry = feature.geometry;

				if (geometry.type.startsWith("Multi")) {
					for (i=0; i < geometry.coordinates.length; i++) {
						newFeature = {
							type: geometry.type.substring(5),
							properties: properties,
							coordinates: geometry.coordinates[i]
						};

						layer = L.GeoJSON.geometryToLayer(newFeature);
						handler._fireCreatedEvent(layer);
					}
				} else {
					layer = L.GeoJSON.geometryToLayer(feature);
					handler._fireCreatedEvent(layer);
				}

				handler.disable();
			});
		},

		_openShapeZip: function(handler, input) {
			if (!input.files && !input.files[0])
				return;

			var reader = new FileReader();

			reader.onload = function() {

				if (reader.readyState !== 2)
					return;

				if (reader.result) {
					ShpZipFormat._parse(handler, reader.result);
				}

			};

			handler._map.fire('draw:importstart');
			reader.readAsArrayBuffer(input.files[0]);
		},

		_parse: function(handler, byteArray) {
			var worker = this._getWorker();
			var id = this._nextId++;
			this._handlers[id] = handler;

			worker.postMessage({id: id, byteArray: byteArray}, [byteArray]);
		},
	};

	L.Draw.Imports.FORMATS.push({
		callback: ShpZipFormat.nop,
		createActionElement: ShpZipFormat.createOpenButton

	});
})();
(function () {

	L.FeatureGroup.Edit = L.Handler.extend({

		initialize: function (layer) {
			this._layer = layer;
		},

		addHooks: function () {
			this._layer.eachLayer(this._enableEditing, this);
			this._layer.on('layeradd', this._enableEditing, this);
			this._layer.on('layerremove', this._disableEditing, this);
		},

		removeHooks: function () {
			this._layer.eachLayer(this._disableEditing, this);
			this._layer.off('layeradd', this._enableEditing, this);
			this._layer.off('layerremove', this._disableEditing, this);
		},

		_disableEditing: function (layer) {
			if (layer.editing) {
				layer.editing.disable();
				layer.off('edit', this._onLayerEdit, this);
			}
		},

		_enableEditing: function (layer) {
			if (layer.editing) {
				layer.editing.enable();
				layer.on('edit', this._onLayerEdit, this);
			}
		},

		_onLayerEdit: function (evt) {
			this._layer.fire('edit', {layer: evt.layer || evt.target});
		}
	});

	L.FeatureGroup.addInitHook(function () {

		if (!this.editing)
			this.editing = new L.FeatureGroup.Edit(this);

	});

})();
L.FeatureGroup.include({
	count: function () {
		var count = 0;

		for (var id in this._layers) {
			if (this._layers[id].count)
				count += this._layers[id].count();
			else
				count++;
		}

		return count;
	}
});
L.FeatureGroup.include({
	isEmpty: function() {

		var empty = true, deepEmpty = true;

		for (var id in this._layers) {
			empty = false;
			if (this._layers[id].isEmpty) {
				if (!this._layers[id].isEmpty())
					return false;
			} else
				deepEmpty = false;
		}

		return empty || deepEmpty;
	}
});
L.FeatureGroup.include({
	setLatLngs: function(latlngs) {
		var count = this.count(), layer;

		if (count === 1) {
			for (var id in this._layers) {
				layer = this._layers[id];

				if (layer.setLatLngs)
					layer.setLatLngs(latlngs);
				else
					throw new Error("L.FeatureGroup doesn't have a layer with setLatLngs");
			}
		} else if (count) {
			throw new Error('Ambigous setLatLngs');
		} else {
			throw new Error("Empty layer!");
		}

	}
});

;(function () {

	var FIX_OPERATIONS = {
		within: {
			check: 'intersects',
			fix: ['intersection']
		}
	};

	var JSTS_METHODS = {
		within: 'within'
	};

	L.FeatureGroup.Fixer = L.Class.extend({

		initialize: function (validation) {
			this._validation = validation;
		},

		within: function () {
			var self = this;
			setTimeout(function() {
				var valid = self._validation.isValid(JSTS_METHODS.within);

				if (!valid) {
					self._fix(JSTS_METHODS.within, FIX_OPERATIONS.within);
				}
			});
		},

		_fix: function (methodName, operation) {


			if (!operation)
				return;

			var checkMethod = operation.check,
			fixMethods = operation.fix;

			this._validation.wait(methodName, function() {
				var featureGroup = this._validation.getFeatureGroup(),
				restrictionLayers = this._validation.getRestrictionLayers(methodName),
				fixedGeometry, i, fixMethod, restoreEdit;

				function fixLayer (geometry, restrictionLayer) {

					restrictionGeometry = restrictionLayer.jsts.geometry();

					if (geometry[checkMethod](restrictionGeometry)) {
						for (i = 0; i < fixMethods.length; i++) {
							fixMethod = fixMethods[i];

							geometry = geometry[fixMethod](restrictionGeometry);
						}
					}

					return geometry;
				}

				featureGroup.eachLayer(function(layer) {
					fixedGeometry = restrictionLayers.reduce(fixLayer, layer.jsts.geometry());

					if (fixedGeometry && fixedGeometry !== layer) {
						if (layer.editing) {
							restoreEdit = layer.editing.enabled();
							layer.editing.disable();
						} else
							restoreEdit = false;

						layer.setLatLngs(L.jsts.jstsToLatLngs(fixedGeometry));

						if (restoreEdit)
							layer.editing.enable();
					}
				});
			}, this);
			
		}
	});

})();
;(function() {

	var JSTS_METHODS = {
		Within: 'within'
	};

	L.FeatureGroup.Validation = L.Handler.extend({

		includes: L.Mixin.Events,

		options: {

		},

		initialize: function(featureGroup) {
			this._featureGroup = featureGroup;
			this._binded = {};
			this._errors = {};
		},

		addHooks: function () {
			var collectionId, collection, methodName;

			for (var name in JSTS_METHODS) {

				methodName = JSTS_METHODS[name];

				collectionId = this._collectionId(methodName);
				collection = this[collectionId];
				if (collection) {
					collection.forEach(this._watch.bind(this, methodName));
				}

				this._watchMe(methodName);
			}

		},

		getRestrictionLayers: function (methodName) {
			var collectionId  = this._collectionId(methodName);
			if (this[collectionId]) {
				return this[collectionId].slice(0);
			}
		},

		getFeatureGroup: function () {
			return this._featureGroup;
		},

		isValid: function(methodName) {
			if (methodName && this._errors[methodName]) {
				return !this._errors[methodName].length;
			}
		},

		fireOnMap: function (eventName, event) {
			if (this._featureGroup._map)
				this._featureGroup._map.fire(eventName, event);
		},

		removeHooks: function () {
			var collectionId, collection, methodName;

			for (var name in JSTS_METHODS) {

				methodName = JSTS_METHODS[name];
				collectionId = this._collectionId(methodName);
				collection = this[collectionId];

				if (collection)
					collection.forEach(this._unwatch.bind(this, methodName));

				this._unwatchMe(methodName);
			}
		},

		/**
		 * Disable temporarily on validation and execute fn
		 * @param  {String}   op validation name
		 * @param  {Function} fn 
		 * @param  {Object} context thisArg
		 * @return {Any} fn result
		 */
		wait: function (methodName, fn, context) {

			var collectionId = this._collectionId(methodName);

			if (this[collectionId]) {
				try {
					this[collectionId].forEach(this._unwatch.bind(this, methodName));
					this._unwatchMe(methodName);

					return fn.call(context, this);
				} finally {
					if (this.enabled()) {
						this[collectionId].forEach(this._watch.bind(this, methodName));
						this._watchMe(methodName);
					}
				}
			}
		},

		within: function () {
			this._on(JSTS_METHODS.Within, Array.prototype.slice.call(arguments, 0));
			return this;
		},

		_collectionId: function (methodName) {
			return methodName ? '_' + methodName + 's' : null;
		},

		_getHandler: function(handler, methodName) {
			var id = L.stamp(handler);

			if (!this._binded[methodName])
				this._binded[methodName] = {};

			if (!this._binded[methodName][id])
				this._binded[methodName][id] = handler.bind(this, methodName);

			return this._binded[methodName][id];
		},

		_off: function (methodName) {
			var collectionId = this._collectionId(methodName);

			if (this[collectionId]) {
				this[collectionId].forEach(this._unwatch.bind(this, methodName));
				delete this[collectionId];
			}
		},

		_on: function (methodName, layers) {
			this._off(methodName);
			this[this._collectionId(methodName)] = layers;
		},

		_validateFeature: function (methodName, evt) {
			this._featureGroup.jsts.clean();
			this._validateTarget(methodName);
		},

		_validateRestriction: function (methodName, evt) {

			if (this._featureGroup.isEmpty())
				return;

			var restrictionId = L.stamp(evt.target);

			if (!this._featureGroup.jsts[methodName](evt.target)) {

				if (!this._errors[methodName])
					this._errors[methodName] = [];

				if (this._errors[methodName].indexOf(restrictionId) === -1)
					this._errors[methodName].push(restrictionId);

				evt = {validation: methodName, targetLayer: this._featureGroup, restrictionLayer: evt.target};

				this.fire('invalid', evt);
				this.fireOnMap('draw:invalid', evt);
			} else {
				if (this._errors[methodName]) {
					var index = this._errors[methodName].indexOf(restrictionId);

					if (index > -1) {
						this._errors[methodName].splice(index, 1);

						if (this._errors[methodName].length === 0) {
							evt = {validation: methodName, targetLayer: this._featureGroup};
							this.fire('valid', evt);
							this.fireOnMap('draw:valid', evt);
						}
					}
				}
			}
		},

		_validateRestrictionFeature: function (methodName, evt) {
			var collectionId = this._collectionId(methodName),
			collection, restrictionLayer;

			if ((collection = this[collectionId])) {
				for (var i = 0; i < collection.length; i++) {
					if (collection[i].hasLayer(evt.target)) {

						(restrictionLayer = collection[i]).jsts.clean();
						break;
					}
				}
			}

			if (restrictionLayer)
				this._validateRestriction(methodName, {target: restrictionLayer});
		},

		_validateTarget: function(methodName) {
			var evt, valid = true;

			if (this._errors[methodName] && this._errors[methodName].length)
				valid = false;

			this._errors[methodName] = [];

			if (this._featureGroup.isEmpty()) {
				if (!valid) {
					evt = {validation: methodName, targetLayer: this._featureGroup};
					this.fire('valid', evt);
					this.fireOnMap('draw:valid', evt);
				}

				return;
			}

			var restrictionLayers = this[this._collectionId(methodName)],
			method = this._featureGroup.jsts[methodName];

			if (restrictionLayers) {
				evt = {validation: methodName, targetLayer: this._featureGroup};

				restrictionLayers.forEach(function(restrictionLayer) {

					if (!method.call(this._featureGroup.jsts, restrictionLayer)) {

						this._errors[methodName].push(L.stamp(restrictionLayer));
						
						evt.restrictionLayer = restrictionLayer;

						this.fire('invalid', evt);
						this.fireOnMap('draw:invalid', evt);
					}

				}, this);

				if (!this._errors[methodName].length && !valid) {

					evt = {validation: methodName, targetLayer: this._featureGroup};
					this.fire('valid', evt);
					this.fireOnMap('draw:valid', evt);
				}
			}
		},

		_unwatch: function (methodName, featureGroup) {
			var watcher = this._getHandler(this._validateRestriction, methodName);

			featureGroup.off('layeradd', watcher);
			featureGroup.off('layerremove', watcher);

			featureGroup.off('layeradd', this._getHandler(this._watchRestrictionFeature, methodName));

			featureGroup.eachLayer(function (layer) {
				if (layer.editing) {
					layer.off('edit', this._getHandler(this._validateRestrictionFeature, methodName));
				}
			}, this);
		},

		_unwatchMe: function (methodName) {

			this._featureGroup.eachLayer(function (layer) {
				if (layer.editing) {
					layer.off('edit', this._getHandler(this._validateFeature, methodName));
				}
			}, this);

			this._featureGroup.off('layeradd', this._getHandler(this._watchFeature, methodName));
			this._featureGroup.off('layeradd layerremove', this._getHandler(this._validateTarget, methodName));
		},

		_watch: function (methodName, featureGroup) {

			var watcher = this._getHandler(this._validateRestriction, methodName);

			featureGroup.eachLayer(function (layer) {
				this._watchRestrictionFeature(methodName, {layer: layer});
			}, this);

			featureGroup.on('layeradd', this._getHandler(this._watchRestrictionFeature, methodName));
			featureGroup.on('layeradd', watcher);
			featureGroup.on('layerremove', watcher);
		},

		_watchFeature: function (methodName, evt) {
			if (evt.layer.editing) {
				evt.layer.on('edit', this._getHandler(this._validateFeature, methodName));
			}
		},

		_watchMe: function (methodName) {

			this._featureGroup.eachLayer(function (layer) {
				this._watchFeature(methodName, {layer: layer});
			}, this);

			this._featureGroup.on('layeradd', this._getHandler(this._watchFeature, methodName));
			this._featureGroup.on('layeradd layerremove', this._getHandler(this._validateTarget, methodName));
		},

		_watchRestrictionFeature: function (methodName, evt) {
			if (evt.layer.editing) {
				evt.layer.on('edit', this._getHandler(this._validateRestrictionFeature, methodName));
			}
		}

	});


	L.FeatureGroup.addInitHook(function () {
		if (!this.validation)
			this.validation = new L.FeatureGroup.Validation(this);

		if (!this.fix)
			this.fix = new L.FeatureGroup.Fixer(this.validation);
	});

})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkltcG9ydHMuanMiLCJTaGFwZVppcC5qcyIsIkwuRmVhdHVyZUdyb3VwLkVkaXQuanMiLCJMLkZlYXR1cmVHcm91cC5jb3VudC5qcyIsIkwuRmVhdHVyZUdyb3VwLmlzRW1wdHkuanMiLCJMLkZlYXR1cmVHcm91cC5zZXRMYXRMbmdzLmpzIiwiTC5HZW9KU09OLmlzRW1wdHkuanMiLCJMLkZlYXR1cmVHcm91cC5GaXhlci5qcyIsIkwuRmVhdHVyZUdyb3VwLlZhbGlkYXRpb24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEJBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoibGVhZmxldC5kcmF3LnBsdXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyI7KGZ1bmN0aW9uKCkge1xuXG5cdGlmICghTC5kcmF3TG9jYWwuZHJhdy50b29sYmFyLmltcG9ydHMpXG5cdFx0TC5kcmF3TG9jYWwuZHJhdy50b29sYmFyLmltcG9ydHMgPSB7fTtcblxuXHRMLkRyYXcuSW1wb3J0cyA9IEwuRHJhdy5GZWF0dXJlLmV4dGVuZCh7XG5cdFx0c3RhdGljczoge1xuXHRcdFx0Rk9STUFUUzogW10sXG5cdFx0XHRUWVBFOiAnaW1wb3J0cydcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKG1hcCwgb3B0aW9ucykge1xuXHRcdFx0dGhpcy50eXBlID0gTC5EcmF3LkltcG9ydHMuVFlQRTtcblxuXHRcdFx0TC5EcmF3LkZlYXR1cmUucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBtYXAsIG9wdGlvbnMpO1xuXHRcdH0sXG5cblx0XHRnZXRBY3Rpb25zOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHJldHVybiBMLkRyYXcuSW1wb3J0cy5GT1JNQVRTLm1hcChmdW5jdGlvbihmb3JtYXQpIHtcblx0XHRcdFx0dmFyIG93bkVsZW1lbnQgPSBudWxsO1xuXG5cdFx0XHRcdGlmIChmb3JtYXQuY3JlYXRlQWN0aW9uRWxlbWVudClcblx0XHRcdFx0XHRvd25FbGVtZW50ID0gZm9ybWF0LmNyZWF0ZUFjdGlvbkVsZW1lbnQuY2FsbCh0aGlzKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0dGl0bGU6IGZvcm1hdC50aXRsZSxcblx0XHRcdFx0XHR0ZXh0OiBmb3JtYXQudGV4dCxcblx0XHRcdFx0XHRjYWxsYmFjazogZm9ybWF0LmNhbGxiYWNrLFxuXHRcdFx0XHRcdGNvbnRleHQ6IHRoaXMsXG5cdFx0XHRcdFx0b3duRWxlbWVudDogb3duRWxlbWVudFxuXHRcdFx0XHR9O1xuXHRcdFx0fSwgdGhpcyk7XG5cdFx0fVxuXHR9KTtcblxufSkoKTsiLCI7KGZ1bmN0aW9uKCkge1xuXG5cdGlmICghTC5kcmF3TG9jYWwuZHJhdy50b29sYmFyLmltcG9ydHMuc2hhcGVaaXApIHtcblx0XHRMLmRyYXdMb2NhbC5kcmF3LnRvb2xiYXIuaW1wb3J0cy5zaGFwZVppcCA9IHtcblx0XHRcdHRleHQ6ICdJbXBvcnQgYSBzaGFwZWZpbGUgemlwJyxcblx0XHRcdHRpdGxlOiAnUGxlYXNlLCBzZWxlY3QgYSB6aXAgZmlsZS4nXG5cdFx0fTtcblx0fVxuXG5cdFNocFppcEZvcm1hdCA9IHtcblxuXHRcdF9oYW5kbGVyczoge30sXG5cblx0XHRfbmV4dElkOiAxLFxuXG5cdFx0Y3JlYXRlT3BlbkJ1dHRvbjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbGluayA9IEwuRG9tVXRpbC5jcmVhdGUoJ2EnKTtcblxuXHRcdFx0bGluay5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG5cdFx0XHRsaW5rLmlubmVySFRNTCA9IEwuZHJhd0xvY2FsLmRyYXcudG9vbGJhci5pbXBvcnRzLnNoYXBlWmlwLnRleHQ7XG5cdFx0XHRsaW5rLnRpdGxlID0gTC5kcmF3TG9jYWwuZHJhdy50b29sYmFyLmltcG9ydHMuc2hhcGVaaXAudGl0bGU7XG5cblx0XHRcdHZhciBpbnB1dCA9IEwuRG9tVXRpbC5jcmVhdGUoJ2lucHV0JywgJ2xlYWZsZXQtZHJhdy1kcmF3LWltcG9ydHMtYWN0aW9uJywgbGluayk7XG5cdFx0XHRpbnB1dC50eXBlID0gJ2ZpbGUnO1xuXG5cdFx0XHR2YXIgaGFuZGxlciA9IHRoaXM7XG5cblx0XHRcdGlucHV0Lm9uY2hhbmdlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFNocFppcEZvcm1hdC5fb3BlblNoYXBlWmlwKGhhbmRsZXIsIGlucHV0KTtcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiBsaW5rO1xuXHRcdH0sXG5cblx0XHRub3A6IGZ1bmN0aW9uKCkge30sXG5cblx0XHRfZ2V0V29ya2VyOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICghdGhpcy5fd29ya2VyKSB7XG5cdFx0XHRcdGlmIChMLkRyYXcuSW1wb3J0cy5TSFBKU19VUkwpIHtcblxuXHRcdFx0XHRcdC8vIE5vIGV4dGVybmFsIC5qcyBzY3JpcHRcblx0XHRcdFx0XHR2YXIgc2NyaXB0ID0gXCJ0cnkgeyBpbXBvcnRTY3JpcHRzKCdcIiArIEwuRHJhdy5JbXBvcnRzLlNIUEpTX1VSTCArIFwiJyk7IH0gY2F0Y2ggKGUpIHtjb25zb2xlLmVycm9yKGUpOyB0aHJvdyBlO31cXG5cIiArXG5cdFx0XHRcdFx0XCJvbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XFxuXCIgK1xuXHRcdFx0XHRcdFx0XCJjb25zb2xlLmxvZygnUHJvY2Vzc2luZyBTaGFwZVppcC4uLicpO1xcblwiICtcblx0XHRcdFx0XHRcdFwidmFyIGdlb0pTT04gPSBzaHAucGFyc2VaaXAoZS5kYXRhLmJ5dGVBcnJheSk7XFxuXCIgK1xuXHRcdFx0XHRcdFx0XCJjb25zb2xlLmxvZygnU2hhcGVaaXAgcHJvY2Vzc2VkIScpO1xcblwiICtcblx0XHRcdFx0XHRcdFwicG9zdE1lc3NhZ2Uoe2lkOiBlLmRhdGEuaWQsIGdlb0pTT046IGdlb0pTT059KTtcXG5cIiArXG5cdFx0XHRcdFx0XCJ9XCI7XG5cblx0XHRcdFx0XHR2YXIgdXJsRGF0YSA9IFVSTC5jcmVhdGVPYmplY3RVUkwobmV3IEJsb2IoW3NjcmlwdF0sIHt0eXBlOiBcImFwcGxpY2F0aW9uL2phdmFzY3JpcHRcIn0pKTtcblx0XHRcdFx0XHR0aGlzLl93b3JrZXIgPSBuZXcgV29ya2VyKHVybERhdGEpO1xuXG5cdFx0XHRcdFx0dGhpcy5fd29ya2VyLm9ubWVzc2FnZSA9IHRoaXMuX29ubWVzc2FnZS5iaW5kKHRoaXMpO1xuXHRcdFx0XHRcdHRoaXMuX3dvcmtlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhhcmd1bWVudHMpO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTmVlZCBzaGFwZWZpbGUtanMgVVJMJyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLl93b3JrZXI7XG5cdFx0fSxcblxuXHRcdF9vbm1lc3NhZ2U6IGZ1bmN0aW9uKGUpIHtcblx0XHRcdHZhciBnZW9KU09OID0gZS5kYXRhLmdlb0pTT047XG5cdFx0XHR2YXIgaGFuZGxlciA9IHRoaXMuX2hhbmRsZXJzW2UuZGF0YS5pZF07XG5cblx0XHRcdC8vIFRPRE86IElzIGl0IGFsd2F5cyBGZWF0dXJlQ29sbGVjdGlvbj9cblx0XHRcdFxuXHRcdFx0dmFyIHByb3BlcnRpZXMsIGdlb21ldHJ5LCBuZXdGZWF0dXJlLCBpLCBsYXllcjtcblxuXHRcdFx0Z2VvSlNPTi5mZWF0dXJlcy5mb3JFYWNoKGZ1bmN0aW9uKGZlYXR1cmUpIHtcblx0XHRcdFx0cHJvcGVydGllcyA9IGZlYXR1cmUucHJvcGVydGllcztcblx0XHRcdFx0Z2VvbWV0cnkgPSBmZWF0dXJlLmdlb21ldHJ5O1xuXG5cdFx0XHRcdGlmIChnZW9tZXRyeS50eXBlLnN0YXJ0c1dpdGgoXCJNdWx0aVwiKSkge1xuXHRcdFx0XHRcdGZvciAoaT0wOyBpIDwgZ2VvbWV0cnkuY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdG5ld0ZlYXR1cmUgPSB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6IGdlb21ldHJ5LnR5cGUuc3Vic3RyaW5nKDUpLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzLFxuXHRcdFx0XHRcdFx0XHRjb29yZGluYXRlczogZ2VvbWV0cnkuY29vcmRpbmF0ZXNbaV1cblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdGxheWVyID0gTC5HZW9KU09OLmdlb21ldHJ5VG9MYXllcihuZXdGZWF0dXJlKTtcblx0XHRcdFx0XHRcdGhhbmRsZXIuX2ZpcmVDcmVhdGVkRXZlbnQobGF5ZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsYXllciA9IEwuR2VvSlNPTi5nZW9tZXRyeVRvTGF5ZXIoZmVhdHVyZSk7XG5cdFx0XHRcdFx0aGFuZGxlci5fZmlyZUNyZWF0ZWRFdmVudChsYXllcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoYW5kbGVyLmRpc2FibGUoKTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRfb3BlblNoYXBlWmlwOiBmdW5jdGlvbihoYW5kbGVyLCBpbnB1dCkge1xuXHRcdFx0aWYgKCFpbnB1dC5maWxlcyAmJiAhaW5wdXQuZmlsZXNbMF0pXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblxuXHRcdFx0XHRpZiAocmVhZGVyLnJlYWR5U3RhdGUgIT09IDIpXG5cdFx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRcdGlmIChyZWFkZXIucmVzdWx0KSB7XG5cdFx0XHRcdFx0U2hwWmlwRm9ybWF0Ll9wYXJzZShoYW5kbGVyLCByZWFkZXIucmVzdWx0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9O1xuXG5cdFx0XHRoYW5kbGVyLl9tYXAuZmlyZSgnZHJhdzppbXBvcnRzdGFydCcpO1xuXHRcdFx0cmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGlucHV0LmZpbGVzWzBdKTtcblx0XHR9LFxuXG5cdFx0X3BhcnNlOiBmdW5jdGlvbihoYW5kbGVyLCBieXRlQXJyYXkpIHtcblx0XHRcdHZhciB3b3JrZXIgPSB0aGlzLl9nZXRXb3JrZXIoKTtcblx0XHRcdHZhciBpZCA9IHRoaXMuX25leHRJZCsrO1xuXHRcdFx0dGhpcy5faGFuZGxlcnNbaWRdID0gaGFuZGxlcjtcblxuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKHtpZDogaWQsIGJ5dGVBcnJheTogYnl0ZUFycmF5fSwgW2J5dGVBcnJheV0pO1xuXHRcdH0sXG5cdH07XG5cblx0TC5EcmF3LkltcG9ydHMuRk9STUFUUy5wdXNoKHtcblx0XHRjYWxsYmFjazogU2hwWmlwRm9ybWF0Lm5vcCxcblx0XHRjcmVhdGVBY3Rpb25FbGVtZW50OiBTaHBaaXBGb3JtYXQuY3JlYXRlT3BlbkJ1dHRvblxuXG5cdH0pO1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuXG5cdEwuRmVhdHVyZUdyb3VwLkVkaXQgPSBMLkhhbmRsZXIuZXh0ZW5kKHtcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uIChsYXllcikge1xuXHRcdFx0dGhpcy5fbGF5ZXIgPSBsYXllcjtcblx0XHR9LFxuXG5cdFx0YWRkSG9va3M6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMuX2xheWVyLmVhY2hMYXllcih0aGlzLl9lbmFibGVFZGl0aW5nLCB0aGlzKTtcblx0XHRcdHRoaXMuX2xheWVyLm9uKCdsYXllcmFkZCcsIHRoaXMuX2VuYWJsZUVkaXRpbmcsIHRoaXMpO1xuXHRcdFx0dGhpcy5fbGF5ZXIub24oJ2xheWVycmVtb3ZlJywgdGhpcy5fZGlzYWJsZUVkaXRpbmcsIHRoaXMpO1xuXHRcdH0sXG5cblx0XHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdFx0dGhpcy5fbGF5ZXIuZWFjaExheWVyKHRoaXMuX2Rpc2FibGVFZGl0aW5nLCB0aGlzKTtcblx0XHRcdHRoaXMuX2xheWVyLm9mZignbGF5ZXJhZGQnLCB0aGlzLl9lbmFibGVFZGl0aW5nLCB0aGlzKTtcblx0XHRcdHRoaXMuX2xheWVyLm9mZignbGF5ZXJyZW1vdmUnLCB0aGlzLl9kaXNhYmxlRWRpdGluZywgdGhpcyk7XG5cdFx0fSxcblxuXHRcdF9kaXNhYmxlRWRpdGluZzogZnVuY3Rpb24gKGxheWVyKSB7XG5cdFx0XHRpZiAobGF5ZXIuZWRpdGluZykge1xuXHRcdFx0XHRsYXllci5lZGl0aW5nLmRpc2FibGUoKTtcblx0XHRcdFx0bGF5ZXIub2ZmKCdlZGl0JywgdGhpcy5fb25MYXllckVkaXQsIHRoaXMpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRfZW5hYmxlRWRpdGluZzogZnVuY3Rpb24gKGxheWVyKSB7XG5cdFx0XHRpZiAobGF5ZXIuZWRpdGluZykge1xuXHRcdFx0XHRsYXllci5lZGl0aW5nLmVuYWJsZSgpO1xuXHRcdFx0XHRsYXllci5vbignZWRpdCcsIHRoaXMuX29uTGF5ZXJFZGl0LCB0aGlzKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0X29uTGF5ZXJFZGl0OiBmdW5jdGlvbiAoZXZ0KSB7XG5cdFx0XHR0aGlzLl9sYXllci5maXJlKCdlZGl0Jywge2xheWVyOiBldnQubGF5ZXIgfHwgZXZ0LnRhcmdldH0pO1xuXHRcdH1cblx0fSk7XG5cblx0TC5GZWF0dXJlR3JvdXAuYWRkSW5pdEhvb2soZnVuY3Rpb24gKCkge1xuXG5cdFx0aWYgKCF0aGlzLmVkaXRpbmcpXG5cdFx0XHR0aGlzLmVkaXRpbmcgPSBuZXcgTC5GZWF0dXJlR3JvdXAuRWRpdCh0aGlzKTtcblxuXHR9KTtcblxufSkoKTsiLCJMLkZlYXR1cmVHcm91cC5pbmNsdWRlKHtcblx0Y291bnQ6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgY291bnQgPSAwO1xuXG5cdFx0Zm9yICh2YXIgaWQgaW4gdGhpcy5fbGF5ZXJzKSB7XG5cdFx0XHRpZiAodGhpcy5fbGF5ZXJzW2lkXS5jb3VudClcblx0XHRcdFx0Y291bnQgKz0gdGhpcy5fbGF5ZXJzW2lkXS5jb3VudCgpO1xuXHRcdFx0ZWxzZVxuXHRcdFx0XHRjb3VudCsrO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb3VudDtcblx0fVxufSk7IiwiTC5GZWF0dXJlR3JvdXAuaW5jbHVkZSh7XG5cdGlzRW1wdHk6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGVtcHR5ID0gdHJ1ZSwgZGVlcEVtcHR5ID0gdHJ1ZTtcblxuXHRcdGZvciAodmFyIGlkIGluIHRoaXMuX2xheWVycykge1xuXHRcdFx0ZW1wdHkgPSBmYWxzZTtcblx0XHRcdGlmICh0aGlzLl9sYXllcnNbaWRdLmlzRW1wdHkpIHtcblx0XHRcdFx0aWYgKCF0aGlzLl9sYXllcnNbaWRdLmlzRW1wdHkoKSlcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2Vcblx0XHRcdFx0ZGVlcEVtcHR5ID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVtcHR5IHx8IGRlZXBFbXB0eTtcblx0fVxufSk7IiwiTC5GZWF0dXJlR3JvdXAuaW5jbHVkZSh7XG5cdHNldExhdExuZ3M6IGZ1bmN0aW9uKGxhdGxuZ3MpIHtcblx0XHR2YXIgY291bnQgPSB0aGlzLmNvdW50KCksIGxheWVyO1xuXG5cdFx0aWYgKGNvdW50ID09PSAxKSB7XG5cdFx0XHRmb3IgKHZhciBpZCBpbiB0aGlzLl9sYXllcnMpIHtcblx0XHRcdFx0bGF5ZXIgPSB0aGlzLl9sYXllcnNbaWRdO1xuXG5cdFx0XHRcdGlmIChsYXllci5zZXRMYXRMbmdzKVxuXHRcdFx0XHRcdGxheWVyLnNldExhdExuZ3MobGF0bG5ncyk7XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJMLkZlYXR1cmVHcm91cCBkb2Vzbid0IGhhdmUgYSBsYXllciB3aXRoIHNldExhdExuZ3NcIik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjb3VudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdBbWJpZ291cyBzZXRMYXRMbmdzJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkVtcHR5IGxheWVyIVwiKTtcblx0XHR9XG5cblx0fVxufSk7IiwiIiwiOyhmdW5jdGlvbiAoKSB7XG5cblx0dmFyIEZJWF9PUEVSQVRJT05TID0ge1xuXHRcdHdpdGhpbjoge1xuXHRcdFx0Y2hlY2s6ICdpbnRlcnNlY3RzJyxcblx0XHRcdGZpeDogWydpbnRlcnNlY3Rpb24nXVxuXHRcdH1cblx0fTtcblxuXHR2YXIgSlNUU19NRVRIT0RTID0ge1xuXHRcdHdpdGhpbjogJ3dpdGhpbidcblx0fTtcblxuXHRMLkZlYXR1cmVHcm91cC5GaXhlciA9IEwuQ2xhc3MuZXh0ZW5kKHtcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICh2YWxpZGF0aW9uKSB7XG5cdFx0XHR0aGlzLl92YWxpZGF0aW9uID0gdmFsaWRhdGlvbjtcblx0XHR9LFxuXG5cdFx0d2l0aGluOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsaWQgPSBzZWxmLl92YWxpZGF0aW9uLmlzVmFsaWQoSlNUU19NRVRIT0RTLndpdGhpbik7XG5cblx0XHRcdFx0aWYgKCF2YWxpZCkge1xuXHRcdFx0XHRcdHNlbGYuX2ZpeChKU1RTX01FVEhPRFMud2l0aGluLCBGSVhfT1BFUkFUSU9OUy53aXRoaW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0X2ZpeDogZnVuY3Rpb24gKG1ldGhvZE5hbWUsIG9wZXJhdGlvbikge1xuXG5cblx0XHRcdGlmICghb3BlcmF0aW9uKVxuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdHZhciBjaGVja01ldGhvZCA9IG9wZXJhdGlvbi5jaGVjayxcblx0XHRcdGZpeE1ldGhvZHMgPSBvcGVyYXRpb24uZml4O1xuXG5cdFx0XHR0aGlzLl92YWxpZGF0aW9uLndhaXQobWV0aG9kTmFtZSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmZWF0dXJlR3JvdXAgPSB0aGlzLl92YWxpZGF0aW9uLmdldEZlYXR1cmVHcm91cCgpLFxuXHRcdFx0XHRyZXN0cmljdGlvbkxheWVycyA9IHRoaXMuX3ZhbGlkYXRpb24uZ2V0UmVzdHJpY3Rpb25MYXllcnMobWV0aG9kTmFtZSksXG5cdFx0XHRcdGZpeGVkR2VvbWV0cnksIGksIGZpeE1ldGhvZCwgcmVzdG9yZUVkaXQ7XG5cblx0XHRcdFx0ZnVuY3Rpb24gZml4TGF5ZXIgKGdlb21ldHJ5LCByZXN0cmljdGlvbkxheWVyKSB7XG5cblx0XHRcdFx0XHRyZXN0cmljdGlvbkdlb21ldHJ5ID0gcmVzdHJpY3Rpb25MYXllci5qc3RzLmdlb21ldHJ5KCk7XG5cblx0XHRcdFx0XHRpZiAoZ2VvbWV0cnlbY2hlY2tNZXRob2RdKHJlc3RyaWN0aW9uR2VvbWV0cnkpKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgZml4TWV0aG9kcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRmaXhNZXRob2QgPSBmaXhNZXRob2RzW2ldO1xuXG5cdFx0XHRcdFx0XHRcdGdlb21ldHJ5ID0gZ2VvbWV0cnlbZml4TWV0aG9kXShyZXN0cmljdGlvbkdlb21ldHJ5KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmZWF0dXJlR3JvdXAuZWFjaExheWVyKGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0XHRcdFx0Zml4ZWRHZW9tZXRyeSA9IHJlc3RyaWN0aW9uTGF5ZXJzLnJlZHVjZShmaXhMYXllciwgbGF5ZXIuanN0cy5nZW9tZXRyeSgpKTtcblxuXHRcdFx0XHRcdGlmIChmaXhlZEdlb21ldHJ5ICYmIGZpeGVkR2VvbWV0cnkgIT09IGxheWVyKSB7XG5cdFx0XHRcdFx0XHRpZiAobGF5ZXIuZWRpdGluZykge1xuXHRcdFx0XHRcdFx0XHRyZXN0b3JlRWRpdCA9IGxheWVyLmVkaXRpbmcuZW5hYmxlZCgpO1xuXHRcdFx0XHRcdFx0XHRsYXllci5lZGl0aW5nLmRpc2FibGUoKTtcblx0XHRcdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdFx0XHRyZXN0b3JlRWRpdCA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0XHRsYXllci5zZXRMYXRMbmdzKEwuanN0cy5qc3RzVG9MYXRMbmdzKGZpeGVkR2VvbWV0cnkpKTtcblxuXHRcdFx0XHRcdFx0aWYgKHJlc3RvcmVFZGl0KVxuXHRcdFx0XHRcdFx0XHRsYXllci5lZGl0aW5nLmVuYWJsZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9LCB0aGlzKTtcblx0XHRcdFxuXHRcdH1cblx0fSk7XG5cbn0pKCk7IiwiOyhmdW5jdGlvbigpIHtcblxuXHR2YXIgSlNUU19NRVRIT0RTID0ge1xuXHRcdFdpdGhpbjogJ3dpdGhpbidcblx0fTtcblxuXHRMLkZlYXR1cmVHcm91cC5WYWxpZGF0aW9uID0gTC5IYW5kbGVyLmV4dGVuZCh7XG5cblx0XHRpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXG5cblx0XHRvcHRpb25zOiB7XG5cblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oZmVhdHVyZUdyb3VwKSB7XG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAgPSBmZWF0dXJlR3JvdXA7XG5cdFx0XHR0aGlzLl9iaW5kZWQgPSB7fTtcblx0XHRcdHRoaXMuX2Vycm9ycyA9IHt9O1xuXHRcdH0sXG5cblx0XHRhZGRIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGNvbGxlY3Rpb25JZCwgY29sbGVjdGlvbiwgbWV0aG9kTmFtZTtcblxuXHRcdFx0Zm9yICh2YXIgbmFtZSBpbiBKU1RTX01FVEhPRFMpIHtcblxuXHRcdFx0XHRtZXRob2ROYW1lID0gSlNUU19NRVRIT0RTW25hbWVdO1xuXG5cdFx0XHRcdGNvbGxlY3Rpb25JZCA9IHRoaXMuX2NvbGxlY3Rpb25JZChtZXRob2ROYW1lKTtcblx0XHRcdFx0Y29sbGVjdGlvbiA9IHRoaXNbY29sbGVjdGlvbklkXTtcblx0XHRcdFx0aWYgKGNvbGxlY3Rpb24pIHtcblx0XHRcdFx0XHRjb2xsZWN0aW9uLmZvckVhY2godGhpcy5fd2F0Y2guYmluZCh0aGlzLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl93YXRjaE1lKG1ldGhvZE5hbWUpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdGdldFJlc3RyaWN0aW9uTGF5ZXJzOiBmdW5jdGlvbiAobWV0aG9kTmFtZSkge1xuXHRcdFx0dmFyIGNvbGxlY3Rpb25JZCAgPSB0aGlzLl9jb2xsZWN0aW9uSWQobWV0aG9kTmFtZSk7XG5cdFx0XHRpZiAodGhpc1tjb2xsZWN0aW9uSWRdKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzW2NvbGxlY3Rpb25JZF0uc2xpY2UoMCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGdldEZlYXR1cmVHcm91cDogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZlYXR1cmVHcm91cDtcblx0XHR9LFxuXG5cdFx0aXNWYWxpZDogZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuXHRcdFx0aWYgKG1ldGhvZE5hbWUgJiYgdGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdKSB7XG5cdFx0XHRcdHJldHVybiAhdGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdLmxlbmd0aDtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZmlyZU9uTWFwOiBmdW5jdGlvbiAoZXZlbnROYW1lLCBldmVudCkge1xuXHRcdFx0aWYgKHRoaXMuX2ZlYXR1cmVHcm91cC5fbWFwKVxuXHRcdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAuX21hcC5maXJlKGV2ZW50TmFtZSwgZXZlbnQpO1xuXHRcdH0sXG5cblx0XHRyZW1vdmVIb29rczogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGNvbGxlY3Rpb25JZCwgY29sbGVjdGlvbiwgbWV0aG9kTmFtZTtcblxuXHRcdFx0Zm9yICh2YXIgbmFtZSBpbiBKU1RTX01FVEhPRFMpIHtcblxuXHRcdFx0XHRtZXRob2ROYW1lID0gSlNUU19NRVRIT0RTW25hbWVdO1xuXHRcdFx0XHRjb2xsZWN0aW9uSWQgPSB0aGlzLl9jb2xsZWN0aW9uSWQobWV0aG9kTmFtZSk7XG5cdFx0XHRcdGNvbGxlY3Rpb24gPSB0aGlzW2NvbGxlY3Rpb25JZF07XG5cblx0XHRcdFx0aWYgKGNvbGxlY3Rpb24pXG5cdFx0XHRcdFx0Y29sbGVjdGlvbi5mb3JFYWNoKHRoaXMuX3Vud2F0Y2guYmluZCh0aGlzLCBtZXRob2ROYW1lKSk7XG5cblx0XHRcdFx0dGhpcy5fdW53YXRjaE1lKG1ldGhvZE5hbWUpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBEaXNhYmxlIHRlbXBvcmFyaWx5IG9uIHZhbGlkYXRpb24gYW5kIGV4ZWN1dGUgZm5cblx0XHQgKiBAcGFyYW0gIHtTdHJpbmd9ICAgb3AgdmFsaWRhdGlvbiBuYW1lXG5cdFx0ICogQHBhcmFtICB7RnVuY3Rpb259IGZuIFxuXHRcdCAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dCB0aGlzQXJnXG5cdFx0ICogQHJldHVybiB7QW55fSBmbiByZXN1bHRcblx0XHQgKi9cblx0XHR3YWl0OiBmdW5jdGlvbiAobWV0aG9kTmFtZSwgZm4sIGNvbnRleHQpIHtcblxuXHRcdFx0dmFyIGNvbGxlY3Rpb25JZCA9IHRoaXMuX2NvbGxlY3Rpb25JZChtZXRob2ROYW1lKTtcblxuXHRcdFx0aWYgKHRoaXNbY29sbGVjdGlvbklkXSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHRoaXNbY29sbGVjdGlvbklkXS5mb3JFYWNoKHRoaXMuX3Vud2F0Y2guYmluZCh0aGlzLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRcdFx0dGhpcy5fdW53YXRjaE1lKG1ldGhvZE5hbWUpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIGZuLmNhbGwoY29udGV4dCwgdGhpcyk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZW5hYmxlZCgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzW2NvbGxlY3Rpb25JZF0uZm9yRWFjaCh0aGlzLl93YXRjaC5iaW5kKHRoaXMsIG1ldGhvZE5hbWUpKTtcblx0XHRcdFx0XHRcdHRoaXMuX3dhdGNoTWUobWV0aG9kTmFtZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHdpdGhpbjogZnVuY3Rpb24gKCkge1xuXHRcdFx0dGhpcy5fb24oSlNUU19NRVRIT0RTLldpdGhpbiwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0X2NvbGxlY3Rpb25JZDogZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcblx0XHRcdHJldHVybiBtZXRob2ROYW1lID8gJ18nICsgbWV0aG9kTmFtZSArICdzJyA6IG51bGw7XG5cdFx0fSxcblxuXHRcdF9nZXRIYW5kbGVyOiBmdW5jdGlvbihoYW5kbGVyLCBtZXRob2ROYW1lKSB7XG5cdFx0XHR2YXIgaWQgPSBMLnN0YW1wKGhhbmRsZXIpO1xuXG5cdFx0XHRpZiAoIXRoaXMuX2JpbmRlZFttZXRob2ROYW1lXSlcblx0XHRcdFx0dGhpcy5fYmluZGVkW21ldGhvZE5hbWVdID0ge307XG5cblx0XHRcdGlmICghdGhpcy5fYmluZGVkW21ldGhvZE5hbWVdW2lkXSlcblx0XHRcdFx0dGhpcy5fYmluZGVkW21ldGhvZE5hbWVdW2lkXSA9IGhhbmRsZXIuYmluZCh0aGlzLCBtZXRob2ROYW1lKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuX2JpbmRlZFttZXRob2ROYW1lXVtpZF07XG5cdFx0fSxcblxuXHRcdF9vZmY6IGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XG5cdFx0XHR2YXIgY29sbGVjdGlvbklkID0gdGhpcy5fY29sbGVjdGlvbklkKG1ldGhvZE5hbWUpO1xuXG5cdFx0XHRpZiAodGhpc1tjb2xsZWN0aW9uSWRdKSB7XG5cdFx0XHRcdHRoaXNbY29sbGVjdGlvbklkXS5mb3JFYWNoKHRoaXMuX3Vud2F0Y2guYmluZCh0aGlzLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzW2NvbGxlY3Rpb25JZF07XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdF9vbjogZnVuY3Rpb24gKG1ldGhvZE5hbWUsIGxheWVycykge1xuXHRcdFx0dGhpcy5fb2ZmKG1ldGhvZE5hbWUpO1xuXHRcdFx0dGhpc1t0aGlzLl9jb2xsZWN0aW9uSWQobWV0aG9kTmFtZSldID0gbGF5ZXJzO1xuXHRcdH0sXG5cblx0XHRfdmFsaWRhdGVGZWF0dXJlOiBmdW5jdGlvbiAobWV0aG9kTmFtZSwgZXZ0KSB7XG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAuanN0cy5jbGVhbigpO1xuXHRcdFx0dGhpcy5fdmFsaWRhdGVUYXJnZXQobWV0aG9kTmFtZSk7XG5cdFx0fSxcblxuXHRcdF92YWxpZGF0ZVJlc3RyaWN0aW9uOiBmdW5jdGlvbiAobWV0aG9kTmFtZSwgZXZ0KSB7XG5cblx0XHRcdGlmICh0aGlzLl9mZWF0dXJlR3JvdXAuaXNFbXB0eSgpKVxuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdHZhciByZXN0cmljdGlvbklkID0gTC5zdGFtcChldnQudGFyZ2V0KTtcblxuXHRcdFx0aWYgKCF0aGlzLl9mZWF0dXJlR3JvdXAuanN0c1ttZXRob2ROYW1lXShldnQudGFyZ2V0KSkge1xuXG5cdFx0XHRcdGlmICghdGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdKVxuXHRcdFx0XHRcdHRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXSA9IFtdO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9lcnJvcnNbbWV0aG9kTmFtZV0uaW5kZXhPZihyZXN0cmljdGlvbklkKSA9PT0gLTEpXG5cdFx0XHRcdFx0dGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdLnB1c2gocmVzdHJpY3Rpb25JZCk7XG5cblx0XHRcdFx0ZXZ0ID0ge3ZhbGlkYXRpb246IG1ldGhvZE5hbWUsIHRhcmdldExheWVyOiB0aGlzLl9mZWF0dXJlR3JvdXAsIHJlc3RyaWN0aW9uTGF5ZXI6IGV2dC50YXJnZXR9O1xuXG5cdFx0XHRcdHRoaXMuZmlyZSgnaW52YWxpZCcsIGV2dCk7XG5cdFx0XHRcdHRoaXMuZmlyZU9uTWFwKCdkcmF3OmludmFsaWQnLCBldnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXSkge1xuXHRcdFx0XHRcdHZhciBpbmRleCA9IHRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXS5pbmRleE9mKHJlc3RyaWN0aW9uSWQpO1xuXG5cdFx0XHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRldnQgPSB7dmFsaWRhdGlvbjogbWV0aG9kTmFtZSwgdGFyZ2V0TGF5ZXI6IHRoaXMuX2ZlYXR1cmVHcm91cH07XG5cdFx0XHRcdFx0XHRcdHRoaXMuZmlyZSgndmFsaWQnLCBldnQpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmZpcmVPbk1hcCgnZHJhdzp2YWxpZCcsIGV2dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdF92YWxpZGF0ZVJlc3RyaWN0aW9uRmVhdHVyZTogZnVuY3Rpb24gKG1ldGhvZE5hbWUsIGV2dCkge1xuXHRcdFx0dmFyIGNvbGxlY3Rpb25JZCA9IHRoaXMuX2NvbGxlY3Rpb25JZChtZXRob2ROYW1lKSxcblx0XHRcdGNvbGxlY3Rpb24sIHJlc3RyaWN0aW9uTGF5ZXI7XG5cblx0XHRcdGlmICgoY29sbGVjdGlvbiA9IHRoaXNbY29sbGVjdGlvbklkXSkpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjb2xsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKGNvbGxlY3Rpb25baV0uaGFzTGF5ZXIoZXZ0LnRhcmdldCkpIHtcblxuXHRcdFx0XHRcdFx0KHJlc3RyaWN0aW9uTGF5ZXIgPSBjb2xsZWN0aW9uW2ldKS5qc3RzLmNsZWFuKCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlc3RyaWN0aW9uTGF5ZXIpXG5cdFx0XHRcdHRoaXMuX3ZhbGlkYXRlUmVzdHJpY3Rpb24obWV0aG9kTmFtZSwge3RhcmdldDogcmVzdHJpY3Rpb25MYXllcn0pO1xuXHRcdH0sXG5cblx0XHRfdmFsaWRhdGVUYXJnZXQ6IGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcblx0XHRcdHZhciBldnQsIHZhbGlkID0gdHJ1ZTtcblxuXHRcdFx0aWYgKHRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXSAmJiB0aGlzLl9lcnJvcnNbbWV0aG9kTmFtZV0ubGVuZ3RoKVxuXHRcdFx0XHR2YWxpZCA9IGZhbHNlO1xuXG5cdFx0XHR0aGlzLl9lcnJvcnNbbWV0aG9kTmFtZV0gPSBbXTtcblxuXHRcdFx0aWYgKHRoaXMuX2ZlYXR1cmVHcm91cC5pc0VtcHR5KCkpIHtcblx0XHRcdFx0aWYgKCF2YWxpZCkge1xuXHRcdFx0XHRcdGV2dCA9IHt2YWxpZGF0aW9uOiBtZXRob2ROYW1lLCB0YXJnZXRMYXllcjogdGhpcy5fZmVhdHVyZUdyb3VwfTtcblx0XHRcdFx0XHR0aGlzLmZpcmUoJ3ZhbGlkJywgZXZ0KTtcblx0XHRcdFx0XHR0aGlzLmZpcmVPbk1hcCgnZHJhdzp2YWxpZCcsIGV2dCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciByZXN0cmljdGlvbkxheWVycyA9IHRoaXNbdGhpcy5fY29sbGVjdGlvbklkKG1ldGhvZE5hbWUpXSxcblx0XHRcdG1ldGhvZCA9IHRoaXMuX2ZlYXR1cmVHcm91cC5qc3RzW21ldGhvZE5hbWVdO1xuXG5cdFx0XHRpZiAocmVzdHJpY3Rpb25MYXllcnMpIHtcblx0XHRcdFx0ZXZ0ID0ge3ZhbGlkYXRpb246IG1ldGhvZE5hbWUsIHRhcmdldExheWVyOiB0aGlzLl9mZWF0dXJlR3JvdXB9O1xuXG5cdFx0XHRcdHJlc3RyaWN0aW9uTGF5ZXJzLmZvckVhY2goZnVuY3Rpb24ocmVzdHJpY3Rpb25MYXllcikge1xuXG5cdFx0XHRcdFx0aWYgKCFtZXRob2QuY2FsbCh0aGlzLl9mZWF0dXJlR3JvdXAuanN0cywgcmVzdHJpY3Rpb25MYXllcikpIHtcblxuXHRcdFx0XHRcdFx0dGhpcy5fZXJyb3JzW21ldGhvZE5hbWVdLnB1c2goTC5zdGFtcChyZXN0cmljdGlvbkxheWVyKSk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdGV2dC5yZXN0cmljdGlvbkxheWVyID0gcmVzdHJpY3Rpb25MYXllcjtcblxuXHRcdFx0XHRcdFx0dGhpcy5maXJlKCdpbnZhbGlkJywgZXZ0KTtcblx0XHRcdFx0XHRcdHRoaXMuZmlyZU9uTWFwKCdkcmF3OmludmFsaWQnLCBldnQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9LCB0aGlzKTtcblxuXHRcdFx0XHRpZiAoIXRoaXMuX2Vycm9yc1ttZXRob2ROYW1lXS5sZW5ndGggJiYgIXZhbGlkKSB7XG5cblx0XHRcdFx0XHRldnQgPSB7dmFsaWRhdGlvbjogbWV0aG9kTmFtZSwgdGFyZ2V0TGF5ZXI6IHRoaXMuX2ZlYXR1cmVHcm91cH07XG5cdFx0XHRcdFx0dGhpcy5maXJlKCd2YWxpZCcsIGV2dCk7XG5cdFx0XHRcdFx0dGhpcy5maXJlT25NYXAoJ2RyYXc6dmFsaWQnLCBldnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdF91bndhdGNoOiBmdW5jdGlvbiAobWV0aG9kTmFtZSwgZmVhdHVyZUdyb3VwKSB7XG5cdFx0XHR2YXIgd2F0Y2hlciA9IHRoaXMuX2dldEhhbmRsZXIodGhpcy5fdmFsaWRhdGVSZXN0cmljdGlvbiwgbWV0aG9kTmFtZSk7XG5cblx0XHRcdGZlYXR1cmVHcm91cC5vZmYoJ2xheWVyYWRkJywgd2F0Y2hlcik7XG5cdFx0XHRmZWF0dXJlR3JvdXAub2ZmKCdsYXllcnJlbW92ZScsIHdhdGNoZXIpO1xuXG5cdFx0XHRmZWF0dXJlR3JvdXAub2ZmKCdsYXllcmFkZCcsIHRoaXMuX2dldEhhbmRsZXIodGhpcy5fd2F0Y2hSZXN0cmljdGlvbkZlYXR1cmUsIG1ldGhvZE5hbWUpKTtcblxuXHRcdFx0ZmVhdHVyZUdyb3VwLmVhY2hMYXllcihmdW5jdGlvbiAobGF5ZXIpIHtcblx0XHRcdFx0aWYgKGxheWVyLmVkaXRpbmcpIHtcblx0XHRcdFx0XHRsYXllci5vZmYoJ2VkaXQnLCB0aGlzLl9nZXRIYW5kbGVyKHRoaXMuX3ZhbGlkYXRlUmVzdHJpY3Rpb25GZWF0dXJlLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpO1xuXHRcdH0sXG5cblx0XHRfdW53YXRjaE1lOiBmdW5jdGlvbiAobWV0aG9kTmFtZSkge1xuXG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAuZWFjaExheWVyKGZ1bmN0aW9uIChsYXllcikge1xuXHRcdFx0XHRpZiAobGF5ZXIuZWRpdGluZykge1xuXHRcdFx0XHRcdGxheWVyLm9mZignZWRpdCcsIHRoaXMuX2dldEhhbmRsZXIodGhpcy5fdmFsaWRhdGVGZWF0dXJlLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpO1xuXG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAub2ZmKCdsYXllcmFkZCcsIHRoaXMuX2dldEhhbmRsZXIodGhpcy5fd2F0Y2hGZWF0dXJlLCBtZXRob2ROYW1lKSk7XG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAub2ZmKCdsYXllcmFkZCBsYXllcnJlbW92ZScsIHRoaXMuX2dldEhhbmRsZXIodGhpcy5fdmFsaWRhdGVUYXJnZXQsIG1ldGhvZE5hbWUpKTtcblx0XHR9LFxuXG5cdFx0X3dhdGNoOiBmdW5jdGlvbiAobWV0aG9kTmFtZSwgZmVhdHVyZUdyb3VwKSB7XG5cblx0XHRcdHZhciB3YXRjaGVyID0gdGhpcy5fZ2V0SGFuZGxlcih0aGlzLl92YWxpZGF0ZVJlc3RyaWN0aW9uLCBtZXRob2ROYW1lKTtcblxuXHRcdFx0ZmVhdHVyZUdyb3VwLmVhY2hMYXllcihmdW5jdGlvbiAobGF5ZXIpIHtcblx0XHRcdFx0dGhpcy5fd2F0Y2hSZXN0cmljdGlvbkZlYXR1cmUobWV0aG9kTmFtZSwge2xheWVyOiBsYXllcn0pO1xuXHRcdFx0fSwgdGhpcyk7XG5cblx0XHRcdGZlYXR1cmVHcm91cC5vbignbGF5ZXJhZGQnLCB0aGlzLl9nZXRIYW5kbGVyKHRoaXMuX3dhdGNoUmVzdHJpY3Rpb25GZWF0dXJlLCBtZXRob2ROYW1lKSk7XG5cdFx0XHRmZWF0dXJlR3JvdXAub24oJ2xheWVyYWRkJywgd2F0Y2hlcik7XG5cdFx0XHRmZWF0dXJlR3JvdXAub24oJ2xheWVycmVtb3ZlJywgd2F0Y2hlcik7XG5cdFx0fSxcblxuXHRcdF93YXRjaEZlYXR1cmU6IGZ1bmN0aW9uIChtZXRob2ROYW1lLCBldnQpIHtcblx0XHRcdGlmIChldnQubGF5ZXIuZWRpdGluZykge1xuXHRcdFx0XHRldnQubGF5ZXIub24oJ2VkaXQnLCB0aGlzLl9nZXRIYW5kbGVyKHRoaXMuX3ZhbGlkYXRlRmVhdHVyZSwgbWV0aG9kTmFtZSkpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRfd2F0Y2hNZTogZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcblxuXHRcdFx0dGhpcy5fZmVhdHVyZUdyb3VwLmVhY2hMYXllcihmdW5jdGlvbiAobGF5ZXIpIHtcblx0XHRcdFx0dGhpcy5fd2F0Y2hGZWF0dXJlKG1ldGhvZE5hbWUsIHtsYXllcjogbGF5ZXJ9KTtcblx0XHRcdH0sIHRoaXMpO1xuXG5cdFx0XHR0aGlzLl9mZWF0dXJlR3JvdXAub24oJ2xheWVyYWRkJywgdGhpcy5fZ2V0SGFuZGxlcih0aGlzLl93YXRjaEZlYXR1cmUsIG1ldGhvZE5hbWUpKTtcblx0XHRcdHRoaXMuX2ZlYXR1cmVHcm91cC5vbignbGF5ZXJhZGQgbGF5ZXJyZW1vdmUnLCB0aGlzLl9nZXRIYW5kbGVyKHRoaXMuX3ZhbGlkYXRlVGFyZ2V0LCBtZXRob2ROYW1lKSk7XG5cdFx0fSxcblxuXHRcdF93YXRjaFJlc3RyaWN0aW9uRmVhdHVyZTogZnVuY3Rpb24gKG1ldGhvZE5hbWUsIGV2dCkge1xuXHRcdFx0aWYgKGV2dC5sYXllci5lZGl0aW5nKSB7XG5cdFx0XHRcdGV2dC5sYXllci5vbignZWRpdCcsIHRoaXMuX2dldEhhbmRsZXIodGhpcy5fdmFsaWRhdGVSZXN0cmljdGlvbkZlYXR1cmUsIG1ldGhvZE5hbWUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fSk7XG5cblxuXHRMLkZlYXR1cmVHcm91cC5hZGRJbml0SG9vayhmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCF0aGlzLnZhbGlkYXRpb24pXG5cdFx0XHR0aGlzLnZhbGlkYXRpb24gPSBuZXcgTC5GZWF0dXJlR3JvdXAuVmFsaWRhdGlvbih0aGlzKTtcblxuXHRcdGlmICghdGhpcy5maXgpXG5cdFx0XHR0aGlzLmZpeCA9IG5ldyBMLkZlYXR1cmVHcm91cC5GaXhlcih0aGlzLnZhbGlkYXRpb24pO1xuXHR9KTtcblxufSkoKTsiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
