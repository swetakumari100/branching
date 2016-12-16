Meteor.methods({
	'livechat:takeInquiry'(inquiryId) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-l-room')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'livechat:takeInquiry' });
		}

		const inquiry = RocketChat.models.LivechatInquiry.findOneById(inquiryId);

		if (!inquiry || inquiry.status === 'taken') {
			throw new Meteor.Error('error-not-allowed', 'Inquiry already taken', { method: 'livechat:takeInquiry' });
		}

		const user = RocketChat.models.Users.findOneById(Meteor.userId());

		const agent = {
			agentId: user._id,
			username: user.username
		};

		// add subscription
		var subscriptionData = {
			rid: inquiry.rid,
			name: inquiry.name,
			alert: true,
			open: true,
			unread: 1,
			code: inquiry.code,
			u: {
				_id: agent.agentId,
				username: agent.username
			},
			t: 'l',
			desktopNotifications: 'all',
			mobilePushNotifications: 'all',
			emailNotifications: 'all'
		};
		RocketChat.models.Subscriptions.insert(subscriptionData);

		// update room
		const room = RocketChat.models.Rooms.findOneById(inquiry.rid);
		const usernames = room.usernames.concat(agent.username);

		RocketChat.models.Rooms.changeAgentByRoomId(inquiry.rid, usernames, agent);

		room.usernames = usernames;
		room.servedBy = {
			_id: agent.agentId,
			username: agent.username
		};

		// mark inquiry as taken
		RocketChat.models.LivechatInquiry.takeInquiry(inquiry._id);

		// remove sending message from guest widget
		// dont check if setting is true, because if settingwas switched off inbetween  guest entered pool,
		// and inquiry being taken, message would not be switched off.
		RocketChat.models.Messages.createCommandWithRoomIdAndUser('connected', room._id, user);

		// return room corresponding to inquiry (for redirecting agent to the room route)
		return room;
	}
});
