Meteor.publish('lists', function() {     
  if (!Match.test(this.userId, String))  
    return [];                           
  return Lists.find({});                 
});

