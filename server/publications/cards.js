Meteor.publish('card', (cardId) => {
  check(cardId, String);
  return Cards.find({ _id: cardId });
});

Meteor.publish('cards', function() {
  if (!Match.test(this.userId, String))
    return [];
  return Cards.find({});
});

