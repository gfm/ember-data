var get = Ember.get, set = Ember.set;
var Post, post, Comment, comment, env;

module("integration/serializer/json - JSONSerializer", {
  setup: function() {
    Post = DS.Model.extend({
      title: DS.attr('string')
    });
    Comment = DS.Model.extend({
      body: DS.attr('string'),
      post: DS.belongsTo('post')
    });
    env = setupStore({
      post:     Post,
      comment:  Comment
    });
    env.store.modelFor('post');
    env.store.modelFor('comment');
  },

  teardown: function() {
    env.store.destroy();
  }
});

asyncTest("serializeAttribute", function() {
  post = env.store.createRecord("post", { title: "Rails is omakase"});
  var json = {};

  env.serializer.serializeAttribute(post, json, "title", {type: "string"}).
                 then(function() {

    deepEqual(json, {
      title: "Rails is omakase"
    });
    start();
  });
});

asyncTest("serializeAttribute respects keyForAttribute", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    keyForAttribute: function(key) {
      return key.toUpperCase();
    }
  }));

  post = env.store.createRecord("post", { title: "Rails is omakase"});
  var json = {};

  env.container.lookup("serializer:post").
                serializeAttribute(post, json, "title", {type: "string"}).
                then(function() {

    deepEqual(json, {
      TITLE: "Rails is omakase"
    });
    start();
  });
});

asyncTest("serializeBelongsTo", function() {
  var post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"}),
      comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post}),
      json = {};

  env.serializer.serializeBelongsTo(comment, json, {key: "post", options: {}}).
                 then(function() {

    deepEqual(json, {
      post: "1"
    });

    json = {};
    set(comment, 'post', null);

    return env.serializer.serializeBelongsTo(comment, json, {key: "post", options: {}});
  }).then(function() {
    deepEqual(json, {
      post: null
    }, "Can set a belongsTo to a null value");

    start();
  });
});

asyncTest("serializeBelongsTo respects keyForRelationship", function() {
  env.container.register('serializer:post', DS.JSONSerializer.extend({
    keyForRelationship: function(key, type) {
      return key.toUpperCase();
    }
  }));
  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post});
  var json = {};

  env.container.lookup("serializer:post").serializeBelongsTo(comment, json, {key: "post", options: {}}).then(function() {

    deepEqual(json, {
      POST: "1"
    });
    start();
  });
});

asyncTest("serializePolymorphicType", function() {
  env.container.register('serializer:comment', DS.JSONSerializer.extend({
    serializePolymorphicType: function(record, json, relationship) {
      var key = relationship.key,
          belongsTo = get(record, key);
      json[relationship.key + "TYPE"] = belongsTo.constructor.typeKey;

      return Ember.RSVP.resolve();
    },
  }));

  post = env.store.createRecord(Post, { title: "Rails is omakase", id: "1"});
  comment = env.store.createRecord(Comment, { body: "Omakase is delicious", post: post});
  var json = {};

  env.container.lookup("serializer:comment").serializeBelongsTo(comment, json, {key: "post", options: { polymorphic: true}}).then(function() {

    deepEqual(json, {
      post: "1",
      postTYPE: "post"
    });
    start();
  });
});
