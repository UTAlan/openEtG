"use strict";
PIXI.AUTO_PREVENT_DEFAULT = false;
(function(){
	var htmlElements = ["leftpane", "chatinput", "aideck", "foename", "chatBox"];
	htmlElements.forEach(function(name){
		window[name] = document.getElementById(name);
	});
})();
(function(){
	var guestname, muteset = {}, muteall;
	var px = require("./px");
	var gfx = require("./gfx");
	var ui = require("./uiutil");
	var chat = require("./chat");
	var Cards = require("./Cards");
	var etgutil = require("./etgutil");
	var options = require("./options");
	var userutil = require("./userutil");
	var startMenu = require("./views/MainMenu");
	options.register("username", document.getElementById("username"));
	var sockEvents = {
		userdump:function(data) {
			delete data.x;
			sock.user = data;
			prepuser();
			startMenu();
		},
		passchange:function(data) {
			sock.user.auth = data.auth;
			chat("Password updated");
		},
		chat:function(data) {
			if (muteall || data.u in muteset || !data.msg) return;
			if (typeof Notification !== "undefined" && sock.user && ~data.msg.indexOf(sock.user.name) && !document.hasFocus()){
				Notification.requestPermission();
				new Notification(data.u, {body: data.msg}).onclick = window.focus;
			}
			var now = new Date(), h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
			if (h < 10) h = "0"+h;
			if (m < 10) m = "0"+m;
			if (s < 10) s = "0"+s;
			var span = document.createElement("span");
			if (data.mode != "red") span.style.color = data.mode || "black";
			if (data.guest) span.style.fontStyle = "italic";
			span.appendChild(document.createTextNode(h + ":" + m + ":" + s + " "));
			if (data.u){
				var belly = document.createElement("b");
				belly.appendChild(document.createTextNode(data.u + ": "));
				span.appendChild(belly);
			}
			var decklink = /\b(([01][0-9a-v]{4})+)\b/g, reres, lastindex = 0;
			while (reres = decklink.exec(data.msg)){
				if (reres.index != lastindex) span.appendChild(document.createTextNode(data.msg.substring(lastindex, reres.index)));
				var link = document.createElement("a");
				link.href = "deck/" + reres[0];
				link.target = "_blank";
				link.appendChild(document.createTextNode(reres[0]));
				span.appendChild(link);
				lastindex = reres.index + reres[0].length;
			}
			if (lastindex != data.msg.length) span.appendChild(document.createTextNode(data.msg.substring(lastindex)));
			chat.addSpan(span);
		},
		cardart:function(data) {
			gfx.preloadCardArt(data.art);
		},
		foearena:function(data) {
			aideck.value = data.deck;
			var game = require("./views/Match")({ deck: data.deck, urdeck: sock.getDeck(), seed: data.seed,
				p2hp: data.hp, foename: data.name, p2drawpower: data.draw, p2markpower: data.mark, arena: data.name, level: 4+data.lv }, true);
			game.cost = userutil.arenaCost(data.lv);
			sock.user.gold -= game.cost;
		},
	};
	var sock = require("./sock");
	sock.et.on("message", function(data){
		data = JSON.parse(data);
		var func = sockEvents[data.x] || (px.realStage.children.length > 1 && px.realStage.children[1].cmds && (func = px.realStage.children[1].cmds[data.x]));
		if (func){
			func.call(sock.et, data);
		}
	});
	require("./etg.client").loadcards(function(){
		if (options.preart) sock.emit("cardart");
	});
	px.load();
	function chatmute(){
		var muted = [];
		for(var name in muteset){
			muted.push(name);
		}
		chat((muteall?"You have chat muted. ":"") + "Muted: " + muted.join(", "));
	}
	function maybeSendChat(e) {
		e.cancelBubble = true;
		if (e.keyCode == 13) {
			e.preventDefault();
			var msg = chatinput.value;
			chatinput.value = "";
			if (msg == "/clear"){
				while (chatBox.firstChild) chatBox.firstChild.remove();
			}else if (msg == "/mute"){
				muteall = true;
				chatmute();
			}else if (msg == "/unmute"){
				muteall = false;
				chatmute();
			}else if (msg.match(/^\/mute /)){
				muteset[msg.substring(6)] = true;
				chatmute();
			}else if (msg.match(/^\/unmute /)){
				delete muteset[msg.substring(8)];
				chatmute();
			}else if (sock.user){
				var msgdata = {msg: msg};
				if (msg.match(/^\/w( |")/)) {
					var match = msg.match(/^\/w"([^"]*)"/);
					var to = (match && match[1]) || msg.substring(3, msg.indexOf(" ", 4));
					if (!to) return;
					chatinput.value = msg.substr(0, 4+to.length);
					msgdata.msg = msg.substr(4+to.length);
					msgdata.to = to;
				}
				if (!msgdata.msg.match(/^\s*$/)) sock.userEmit("chat", msgdata);
			}
			else if (!msg.match(/^\s*$/)) {
				var name = options.username || guestname || (guestname = (10000 + Math.floor(Math.random() * 89999)) + "");
				sock.emit("guestchat", { msg: msg, u: name });
			}
		}
	}
	function unaryParseInt(x) {
		return parseInt(x, 10);
	}
	function maybeLogin(e) {
		e.cancelBubble = true;
		if (e.keyCode == 13) {
			this.blur();
			loginClick();
		}
	}
	function prepuser(){
		sock.user.decks = sock.user.decks.split(",");
		sock.user.pool = sock.user.pool || "";
		sock.user.accountbound = sock.user.accountbound || "";
		if (!sock.user.quest) {
			sock.user.quest = {};
		}
		if (sock.user.freepacks) {
			sock.user.freepacks = sock.user.freepacks.split(",").map(unaryParseInt);
		}
		if (!sock.user.ailosses) sock.user.ailosses = 0;
		if (!sock.user.aiwins) sock.user.aiwins = 0;
		if (!sock.user.pvplosses) sock.user.pvplosses = 0;
		if (!sock.user.pvpwins) sock.user.pvpwins = 0;
	}
	function loginClick() {
		if (!sock.user && options.username) {
			var password = document.getElementById("password").value;
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "auth?u=" + encodeURIComponent(options.username) + (password.length ? "&p=" + encodeURIComponent(password) : ""), true);
			xhr.onreadystatechange = function() {
				if (this.readyState == 4) {
					if (this.status == 200) {
						sock.user = JSON.parse(this.responseText);
						if (!sock.user) {
							chat("No user");
						} else if (!sock.user.accountbound && !sock.user.pool) {
							require("./views/ElementSelect")();
						} else {
							prepuser();
							startMenu();
						}
					} else if (this.status == 404) {
						chat("Incorrect password");
					} else if (this.status == 502) {
						chat("Error verifying password");
					}
				}
			}
			xhr.send();
		}
	}
	function changeClick() {
		sock.userEmit("passchange", { p: password.value });
	}
	function aiClick() {
		var deck = sock.getDeck(), aideckcode = aideck.value;
		if (etgutil.decklength(deck) < 11 || etgutil.decklength(aideckcode) < 11) {
			require("./views/Editor")();
			return;
		}
		var gameData = { deck: aideckcode, urdeck: deck, seed: Math.random() * etgutil.MAX_INT, foename: "Custom", cardreward: "" };
		ui.parsepvpstats(gameData);
		ui.parseaistats(gameData);
		require("./views/Match")(gameData, true);
	}
	(function(callbacks){
		for(var id in callbacks){
			for(var event in callbacks[id]){
				document.getElementById(id).addEventListener(event, callbacks[id][event]);
			}
		}
	})({
		leftpane: {click: leftpane.blur},
		change: {click: changeClick},
		login: {click: loginClick},
		username: {keydown: maybeLogin},
		password: {keydown: maybeLogin},
		chatinput: {keydown: maybeSendChat},
		aivs: {click: aiClick},
	});
})();