var get = Ember.get, set = Ember.set, isNone = Ember.isNone;

// Simple dispatcher to support overriding the aliased
// method in subclasses.
function aliasMethod(methodName) {
  return function() {
    return this[methodName].apply(this, arguments);
  };
}

DS.JSONSerializer = Ember.Object.extend({
  primaryKey: 'id',

  applyTransforms: function(type, data) {
    type.eachTransformedAttribute(function(key, type) {
      var transform = this.transformFor(type);
      data[key] = transform.deserialize(data[key]);
    }, this);

    return data;
  },

  normalize: function(type, hash) {
    if (!hash) { return hash; }

    this.applyTransforms(type, hash);
    return hash;
  },

  // SERIALIZE

  serialize: function(record, options) {
    var self = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var json = {};

      if (options && options.includeId) {
        var id = get(record, 'id');

        if (id) {
          json[get(self, 'primaryKey')] = get(record, 'id');
        }
      }

      var promises = [];

      record.eachAttribute(function(key, attribute) {
        promises.push(self.serializeAttribute(record, json, key, attribute));
      }, self);

      record.eachRelationship(function(key, relationship) {
        if (relationship.kind === 'belongsTo') {
          promises.push(self.serializeBelongsTo(record, json, relationship));
        } else if (relationship.kind === 'hasMany') {
          promises.push(self.serializeHasMany(record, json, relationship));
        }
      }, self);

      return Ember.RSVP.all(promises).
                        then(function() { return json; }).
                        then(resolve, reject);
    });
  },

  serializeAttribute: function(record, json, key, attribute) {
    var attrs = get(this, 'attrs'),
        promise,
        self = this,
        value = get(record, key), type = attribute.type;

    if (type) {
      var transform = this.transformFor(type);
      promise = Ember.RSVP.resolve(transform.serialize(value));
    } else {
      promise = Ember.RSVP.resolve(value);
    }

    return promise.then(function(value) {
      // if provided, use the mapping provided by `attrs` in
      // the serializer
      key = attrs && attrs[key] ||
            (self.keyForAttribute ? self.keyForAttribute(key) : key);

      json[key] = value;
    });
  },

  serializeBelongsTo: function(record, json, relationship) {
    var key = relationship.key;

    var belongsTo = get(record, key);

    key = this.keyForRelationship ? this.keyForRelationship(key, "belongsTo") : key;

    if (isNone(belongsTo)) {
      json[key] = belongsTo;
    } else {
      json[key] = get(belongsTo, 'id');
    }

    if (relationship.options.polymorphic) {
      return Ember.RSVP.resolve(this.serializePolymorphicType(record, json, relationship));
    }

    return Ember.RSVP.resolve();
  },

  serializeHasMany: function(record, json, relationship) {
    var key = relationship.key;

    var relationshipType = DS.RelationshipChange.determineRelationshipType(record.constructor, relationship);

    if (relationshipType === 'manyToNone' || relationshipType === 'manyToMany') {
      json[key] = get(record, key).mapBy('id');
      // TODO support for polymorphic manyToNone and manyToMany relationships
    }

    return Ember.RSVP.resolve();
  },

  /**
    You can use this method to customize how polymorphic objects are serialized.
  */
  serializePolymorphicType: Ember.K,

  // EXTRACT

  extract: function(store, type, payload, id, requestType) {
    this.extractMeta(store, type, payload);

    var specificExtract = "extract" + requestType.charAt(0).toUpperCase() + requestType.substr(1);
    return this[specificExtract](store, type, payload, id, requestType);
  },

  extractFindAll: aliasMethod('extractArray'),
  extractFindQuery: aliasMethod('extractArray'),
  extractFindMany: aliasMethod('extractArray'),
  extractFindHasMany: aliasMethod('extractArray'),

  extractCreateRecord: aliasMethod('extractSave'),
  extractUpdateRecord: aliasMethod('extractSave'),
  extractDeleteRecord: aliasMethod('extractSave'),

  extractFind: aliasMethod('extractSingle'),
  extractFindBelongsTo: aliasMethod('extractSingle'),
  extractSave: aliasMethod('extractSingle'),

  extractSingle: function(store, type, payload) {
    return this.normalize(type, payload);
  },

  extractArray: function(store, type, payload) {
    return this.normalize(type, payload);
  },

  extractMeta: function(store, type, payload) {
    if (payload && payload.meta) {
      store.metaForType(type, payload.meta);
      delete payload.meta;
    }
  },

  // HELPERS

  transformFor: function(attributeType) {
    return this.container.lookup('transform:' + attributeType);
  }
});
