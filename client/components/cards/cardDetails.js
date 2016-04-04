BlazeComponent.extendComponent({
  canAssignToMe() {
    const card = this.currentData();
    const list = card.list();
    if (list.title !== "Completed") {
      if (card.members.length == 0) {
        return true;
      } else {
        return card.members[0] !== Meteor.userId();
      }
    }
    return false;
  },
  canUnassignMe() {
    const card = this.currentData();
    const list = card.list();
    return list.title === "Assigned" &&
           card.members.length > 0 &&
           card.members[0] === Meteor.userId();
  },
  statusLine() {
    const card = this.currentData();
    const list = card.list();
    if (list.title === "Waiting") {
      return "Created " + moment(card.createdAt).fromNow();
    } else {
      const user = Users.findOne(card.members[0]);
      const action = (list.title === "Assigned") ? "Assigned to " : "Completed by ";
      //const activity = Activities.find({userId: user._id, activityType : "moveCard"}, {sort: {createdAt: -1}, limit: 1}).fetch().pop();
      return action + user.getName(); //moment(activity.createdAt).fromNow();
    }
  },
  statusClass() {
    const card = this.currentData();
    const list = card.list();
    if (list.title === "Waiting") {
      return "oe-status-waiting";
    } else if (list.title === "Assigned") {
      return "oe-status-assigned";
    } else {
      return "oe-status-completed";
    }
  },
  events() {
    return [{
    'click .oe-action-assign'(evt) {
      evt.preventDefault();
      var card = Cards.findOne(this.currentData()._id);
      const assigned = Lists.findOne({ boardId: card.boardId, title: 'Assigned' });
      card.toggleMember(Meteor.userId());
      card.move(assigned._id, 0);
    },
    'click .oe-action-unassign'(evt) {
      evt.preventDefault();
      var card = Cards.findOne(this.currentData()._id);
      const waiting = Lists.findOne({ boardId: card.boardId, title: 'Waiting' });
      card.toggleMember(Meteor.userId());
      card.move(waiting._id, 0);
    },
    'click .oe-action-complete'(evt) {
      evt.preventDefault();
      var card = Cards.findOne(this.currentData()._id);
      const completed = Lists.findOne({ boardId: card.boardId, title: 'Completed' });
      card.move(completed._id, 0);
    },
    'click #body'(evt) {
      console.log("BODY CLICKED!");
      evt.preventDefault();
    }
    }];
  }
}).register('cardCompact');

BlazeComponent.extendComponent({
  mixins() {
    return [Mixins.InfiniteScrolling, Mixins.PerfectScrollbar];
  },

  calculateNextPeak() {
    const cardElement = this.find('.js-card-details');
    if (cardElement) {
      const altitude = cardElement.scrollHeight;
      this.callFirstWith(this, 'setNextPeak', altitude);
    }
  },

  reachNextPeak() {
    const activitiesComponent = this.childComponents('activities')[0];
    activitiesComponent.loadNextPage();
  },

  onCreated() {
    this.isLoaded = new ReactiveVar(false);
    this.parentComponent().showOverlay.set(true);
    this.parentComponent().mouseHasEnterCardDetails = false;
    this.calculateNextPeak();
  },

  isWatching() {
    const card = this.currentData();
    return card.findWatcher(Meteor.userId());
  },

  scrollParentContainer() {
    const cardPanelWidth = 510;
    const bodyBoardComponent = this.parentComponent();

    const $cardContainer = bodyBoardComponent.$('.js-lists');
    const $cardView = this.$(this.firstNode());
    const cardContainerScroll = $cardContainer.scrollLeft();
    const cardContainerWidth = $cardContainer.width();

    const cardViewStart = $cardView.offset().left;
    const cardViewEnd = cardViewStart + cardPanelWidth;

    let offset = false;
    if (cardViewStart < 0) {
      offset = cardViewStart;
    } else if(cardViewEnd > cardContainerWidth) {
      offset = cardViewEnd - cardContainerWidth;
    }

    if (offset) {
      bodyBoardComponent.scrollLeft(cardContainerScroll + offset);
    }
  },

  onRendered() {
    if (!Utils.isMiniScreen()) this.scrollParentContainer();
  },

  onDestroyed() {
    this.parentComponent().showOverlay.set(false);
  },

  events() {
    const events = {
      [`${CSSEvents.animationend} .js-card-details`]() {
        this.isLoaded.set(true);
      },
    };

    return [{
      ...events,
      'click .js-close-card-details'() {
        Utils.goBoardId(this.data().boardId);
      },
      'click .js-open-card-details-menu': Popup.open('cardDetailsActions'),
      'submit .js-card-description'(evt) {
        evt.preventDefault();
        const description = this.currentComponent().getValue();
        this.data().setDescription(description);
      },
      'submit .js-card-details-title'(evt) {
        evt.preventDefault();
        const title = this.currentComponent().getValue().trim();
        if (title) {
          this.data().setTitle(title);
        }
      },
      'click .js-member': Popup.open('cardMember'),
      'click .js-add-members': Popup.open('cardMembers'),
      'click .js-add-labels': Popup.open('cardLabels'),
      'mouseenter .js-card-details'() {
        this.parentComponent().showOverlay.set(true);
        this.parentComponent().mouseHasEnterCardDetails = true;
      },
    }];
  },
}).register('cardDetails');

// We extends the normal InlinedForm component to support UnsavedEdits draft
// feature.
(class extends InlinedForm {
  _getUnsavedEditKey() {
    return {
      fieldName: 'cardDescription',
      // XXX Recovering the currentCard identifier form a session variable is
      // fragile because this variable may change for instance if the route
      // change. We should use some component props instead.
      docId: Session.get('currentCard'),
    };
  }

  close(isReset = false) {
    if (this.isOpen.get() && !isReset) {
      const draft = this.getValue().trim();
      if (draft !== Cards.findOne(Session.get('currentCard')).description) {
        UnsavedEdits.set(this._getUnsavedEditKey(), this.getValue());
      }
    }
    super.close();
  }

  reset() {
    UnsavedEdits.reset(this._getUnsavedEditKey());
    this.close(true);
  }

  events() {
    const parentEvents = InlinedForm.prototype.events()[0];
    return [{
      ...parentEvents,
      'click .js-close-inlined-form': this.reset,
    }];
  }
}).register('inlinedCardDescription');

Template.cardDetailsActionsPopup.helpers({
  isWatching() {
    return this.findWatcher(Meteor.userId());
  },
});

Template.cardDetailsActionsPopup.events({
  'click .js-members': Popup.open('cardMembers'),
  'click .js-labels': Popup.open('cardLabels'),
  'click .js-attachments': Popup.open('cardAttachments'),
  'click .js-move-card': Popup.open('moveCard'),
  'click .js-move-card-to-top'(evt) {
    evt.preventDefault();
    const minOrder = _.min(this.list().cards().map((c) => c.sort));
    this.move(this.listId, minOrder / 2);
  },
  'click .js-move-card-to-bottom'(evt) {
    evt.preventDefault();
    const maxOrder = _.max(this.list().cards().map((c) => c.sort));
    this.move(this.listId, Math.floor(maxOrder) + 1);
  },
  'click .js-archive'(evt) {
    evt.preventDefault();
    this.archive();
    Popup.close();
  },
  'click .js-more': Popup.open('cardMore'),
  'click .js-toggle-watch-card'() {
    const currentCard = this;
    const level = currentCard.findWatcher(Meteor.userId()) ? null : 'watching';
    Meteor.call('watch', 'card', currentCard._id, level, (err, ret) => {
      if (!err && ret) Popup.close();
    });
  },
});

Template.editCardTitleForm.onRendered(function() {
  autosize(this.$('.js-edit-card-title'));
});

Template.editCardTitleForm.events({
  'keydown .js-edit-card-title'(evt) {
    // If enter key was pressed, submit the data
    if (evt.keyCode === 13) {
      $('.js-submit-edit-card-title-form').click();
    }
  },
});

Template.moveCardPopup.events({
  'click .js-select-list'() {
    // XXX We should *not* get the currentCard from the global state, but
    // instead from a “component” state.
    const card = Cards.findOne(Session.get('currentCard'));
    const newListId = this._id;
    card.move(newListId);
    Popup.close();
  },
});

Template.cardMorePopup.events({
  'click .js-delete': Popup.afterConfirm('cardDelete', function() {
    Popup.close();
    Cards.remove(this._id);
    Utils.goBoardId(this.boardId);
  }),
});

// Close the card details pane by pressing escape
EscapeActions.register('detailsPane',
  () => { Utils.goBoardId(Session.get('currentBoard')); },
  () => { return !Session.equals('currentCard', null); }, {
    noClickEscapeOn: '.js-card-details,.board-sidebar,#header',
  }
);
