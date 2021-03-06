Channel = BlazeComponent.extendComponent({
  onCreated: function () {
    var self = this;

    // Used to indicate that the user's scroll position
    // is near the bottom, see `calculateNearBottom` method
    self.isNearBottom = new ReactiveVar(false);

    // Listen for changes to reactive variables (such as FlowRouter.getParam()).
    self.autorun(function () {
      currentChannel() && self.subscribe('messages', currentChannelId(), function () {
        // On channel load, scroll page to the bottom
        scrollDown();
      });
    });
  },
  onRendered: function () {
    var self = this;

    // Listen to scroll events to see if we're near the bottom
    // This is used to detect whether we should auto-scroll down
    // when a new message arrives
    $(window)
      .on('scroll', self.calculateNearBottom.bind(self))
      // And also trigger it initially
      .trigger('scroll');

    // We need to do this in an autorun because
    // for some reason the currentChannelId is not
    // available until a bit later
    self.autorun(function () {
      if (currentChannelId()) {
        // Note: this scrollDown does work
        // Observe the changes on the messages for this channel
        self.messageObserveHandle = Messages.find({
          channelId: currentChannelId()
        }).observeChanges({
          // When a new message is added
          added: function (id, doc) {
            // Trigger the scroll down method which determines whether to scroll down or not
            if (self.isNearBottom.get()) {
              scrollDown();
            }
          }
        });
      }
    });
  },
  onDestroyed: function () {
    var self = this;
    // Prevents memory leaks!
    self.messageObserveHandle && self.messageObserveHandle.stop();
    // Stop listening to scroll events
    $(window).off(self.calculateNearBottom);
  },
  calculateNearBottom: function () {
    var self = this;
    // You are near the bottom if you're at least 200px from the bottom
    self.isNearBottom.set((window.innerHeight + window.scrollY) >= (
      Number(document.body.offsetHeight) - 200));
  },
  messages: function () {
    return Messages.find({
      channelId: currentChannelId()
    });
  },
  channel: function () {
    return Channels.findOne({
      _id: currentChannelId()
    });
  },
  user: function () {
    return Meteor.users.findOne({
      _id: this.currentData()._userId
    });
  },
  time: function () {
    return moment(this.timestamp).format('h:mm a');
  },
  date: function () {
    var dateNow = moment(this.currentData().timestamp).calendar();

    if (!this.date || this.date !== dateNow) {
      return this.date = dateNow;
    }
  },
  avatar: function () {
    var user = Meteor.users.findOne(this.currentData().userId);
    if (user && user.emails) {
      return Gravatar.imageUrl(user.emails[0].address);
    }
  },
  events: function () {
    return [
      {
        'keydown textarea[name=message]': function (event) {
          if (isEnter(event) && !event.shiftKey) { // Check if enter was pressed (but without shift).
            event.preventDefault();
            var _id = currentRouteId();
            var value = this.find('textarea[name=message]').value;
            // Markdown requires double spaces at the end of the line to force line-breaks.
            value = value.replace("\n", "  \n");

            // Prevent accepting empty message
            if ($.trim(value) === "") return;

            this.find('textarea[name=message]').value = ''; // Clear the textarea.
            Messages.insert({
              // TODO: should be checked server side if the user is allowed to do this
              channelId: currentChannelId(),
              message: value
            });
            // Restore the autosize value.
            this.$('textarea[name=message]').css({
              height: 37
            });
            scrollDown();
          }
        },
        'click [data-action="remove-channel"]': function (event) {
          event.preventDefault();

          if (!currentChannel()) {
            swal({
              title: 'Yikes! Something went wrong',
              text: "We can't find the current channel at the moment, are you still online?",
              type: 'error'
            });
          } else {
            var channelName = currentChannel().name;

            // swal is provided by kevohagan:sweetalert
            swal({
              title: 'Delete #' + channelName,
              text: 'Deleting this channel will delete all of the messages in ' +
              'it, for everyone in your team, forever.' +
              ' To confirm, enter <strong>' +
              currentChannel().name + '</strong> below.',
              html: true,
              type: 'input',
              showCancelButton: true,
              closeOnConfirm: false,
              confirmButtonText: 'Delete ' + channelName,
              confirmButtonColor: '#ec6c62',
            }, function (inputValue) {
              if (inputValue === channelName) {
                Meteor.call('channels.remove', currentChannelId(),
                  function (error) {
                    if (error) {
                      swal({
                        title: 'Yikes! Something went wrong',
                        text: error.reason,
                        type: 'error'
                      });
                    } else {
                      swal({
                        title: 'Channel deleted!',
                        text: 'The <strong>#' + channelName + '</strong> ' +
                        'channel is gone forever!',
                        type: 'success',
                        html: true
                      });
                      // TODO: Redirect to the actual team home of the user's team
                      FlowRouter.go('teamHome', { team: 'public' });
                    }
                  });
              } else {
                swal({
                  title: "Incorrect channel name",
                  type: "info",
                  text: "You didn't type the channel name correctly, so we haven't deleted it."
                });
              }
            });
          }
        },
        'click [data-action="display-channel-info"]': function (event) {
          event.preventDefault();
          $('.channel-info').toggleClass('channel-info-out');
          $('.channel-content').toggleClass('channel-content-full');
          $('.channel-footer').toggleClass('channel-footer-full');
        },

        'click .channel-title': function(event) {
          event.preventDefault();

          this.$(".channel-dropdown").toggleClass("hidden");
          if ($(".channel-dropdown").not('.hidden')) {
            $('.channel-dropdown-topic-input').focus();
          }
        },

        'keydown input[name=channel-topic]': function (event) {

          if (isEnter(event)) {
            var content = this.find('input[name=channel-topic]').value;
            Meteor.call('channels.updateTopic', currentChannelId(), content);
            // Hide the dropdown.
            this.$(".channel-dropdown").toggleClass("hidden");
          }
        }
      }];
  }
}).register('channel');
