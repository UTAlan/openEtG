var px = require("./px");
var gfx = require("./gfx");
var sock = require("./sock");
var Quest = require("./Quest");
function startQuest(questname) {
	if (!sock.user.quest[questname] && sock.user.quest[questname] != 0) {
		sock.user.quest[questname] = 0;
		sock.userEmit("updatequest", { quest: questname, newstage: 0 });
	}
}
module.exports = function(area) {
	var questui = px.mkView(function() {
		tinfo.setText("");
	});
	questui.addChild(px.mkBgRect(9, 9, 880, 111));
	var questmap = new PIXI.Sprite(gfx.bg_quest);
	questmap.position.set(124, 162);
	questui.addChild(questmap);
	var tinfo = new px.MenuText(50, 26, "", 850);
	var errinfo = new px.MenuText(50, 125, "", 850);
	function makeQuestButton(quest, stage) {
		var pos = Quest[quest].info.pos[stage];
		var circle = new PIXI.Graphics();
		circle.lineStyle(2, 0x88aa66);
		circle.beginFill(sock.user.quest[quest] > stage ? 0x4cff00 : 1);
		circle.drawCircle(0, 0, 16);
		circle.endFill();
		circle.hitArea = new PIXI.Circle(0, 0, 16);
		var button = px.mkButton(pos[0], pos[1], circle);
		button.mouseover = function() {
			tinfo.setText(Quest[quest].info.text[stage]);
		}
		px.setClick(button, function() {
			errinfo.setText(Quest.mkQuestAi(quest, stage, area) || "");
		});
		return button;
	}
	Quest.areas[area].forEach(function(quest){
		var stage0 = Quest[quest][0];
		if (stage0.dependency === undefined || stage0.dependency(sock.user))
			startQuest(quest);
	});
	Quest.areas[area].forEach(function(quest){
		if ((sock.user.quest[quest] !== undefined) && Quest[quest]) {
			for (var i = 0;i <= sock.user.quest[quest];i++) {
				if (Quest[quest].info.pos[i]) {
					questui.addChild(makeQuestButton(quest, i));
				}
			}
		}
	});
	var bexit = px.mkButton(750, 246, "Exit");
	px.setClick(bexit, require("./QuestMain"));
	questui.addChild(tinfo);
	questui.addChild(errinfo);
	questui.addChild(bexit);
	px.refreshRenderer(questui);
}