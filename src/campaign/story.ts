import type { PlayerId } from '../engine/types';

/** The cast. Original characters; portraits are initials until the art pass. */
export const SPEAKERS = {
  kerrow: { name: 'Sgt. Ada Kerrow', role: 'Your adjutant', side: 'red', initials: 'AK' },
  hallam: { name: 'Col. Rook Hallam', role: 'Red command', side: 'red', initials: 'RH' },
  orlen: { name: 'Gen. Vass Orlen', role: 'Blue high command', side: 'blue', initials: 'VO' },
  grey: { name: 'Maj. Tamsin Grey', role: 'Blue field commander', side: 'blue', initials: 'TG' },
  kade: { name: 'Cdre. Idris Kade', role: 'Blue coastal fleet', side: 'blue', initials: 'IK' },
} as const satisfies Record<string, { name: string; role: string; side: PlayerId; initials: string }>;

export type SpeakerId = keyof typeof SPEAKERS;

export interface StoryLine {
  who: SpeakerId;
  text: string;
}

export interface MissionStory {
  /** Shown on the briefing card. */
  before: StoryLine[];
  /** Shown on the results card after a win. */
  after: StoryLine[];
}

const l = (who: SpeakerId, text: string): StoryLine => ({ who, text });

/** Book I dialogue, by mission index. */
export const STORY: MissionStory[] = [
  // ----- Act I — The Valley -----
  {
    before: [
      l('kerrow', "Welcome to the valley, Commander. Sergeant Kerrow, your adjutant. I keep the coffee hot and the maps dry."),
      l('hallam', 'Blue scouts crossed the border at dawn. Send them home. Politely, if possible.'),
      l('kerrow', "It won't be possible."),
    ],
    after: [
      l('kerrow', 'Two scouts fewer and a city on our books. Not a bad first day.'),
      l('grey', 'Red has a new commander. Noted.'),
    ],
  },
  {
    before: [
      l('hallam', "The factories here are ours to use. Build what you need, but spend like it's your own money."),
      l('kerrow', "It isn't our money, sir."),
      l('hallam', "Then spend like it's mine."),
    ],
    after: [
      l('orlen', 'A factory skirmish. Major Grey, remind me why I am being told about this.'),
      l('grey', 'Because they won it, General.'),
    ],
  },
  {
    before: [
      l('kerrow', "Bad news: Blue's counterattack is coming straight at us, and the factories are behind their lines."),
      l('kerrow', 'Good news: the forests are on our side. Dig in and hold until relief arrives on day 6.'),
    ],
    after: [
      l('hallam', "Relief column's through. You held. I'll put that in writing."),
      l('kerrow', 'He never puts anything in writing.'),
    ],
  },
  {
    before: [
      l('grey', 'Thunder Ridge has two passes, and I have guns on both. Come ahead, Red.'),
      l('kerrow', "She isn't bluffing. Artillery can't fire after moving, or at anything right beside it. Get close, fast."),
    ],
    after: [
      l('grey', 'Pulling back from the ridge. Well fought.'),
      l('kerrow', 'Did the enemy commander just compliment us?'),
    ],
  },
  {
    before: [
      l('hallam', 'The towns on those plains are unclaimed. Whoever holds eight of them pays the bills this winter.'),
      l('kerrow', "Recon is fast but can't capture. Infantry does the paperwork."),
    ],
    after: [
      l('kerrow', 'Eight flags up. The tax office is thrilled.'),
      l('orlen', 'Towns! They are fighting over towns. Buy them back, Major.'),
    ],
  },
  {
    before: [
      l('kerrow', 'Rotor noise over the ridge. Blue has gunships.'),
      l('hallam', 'Anti-air to the front. And you have a helicopter of your own now, Commander. Try not to scratch it.'),
    ],
    after: [
      l('kerrow', 'Skies are clear. The pilots want a bigger hangar.'),
      l('hallam', 'The pilots always want a bigger hangar.'),
    ],
  },
  {
    before: [
      l('grey', 'Heavy armor is rolling. I would advise your infantry to seek other employment.'),
      l('kerrow', 'Heavies are slow and pricey. Soften them with artillery, then finish them with bazookas.'),
    ],
    after: [
      l('orlen', 'Sixteen thousand a tank, Major. Sixteen thousand!'),
      l('grey', 'They were very good tanks, General.'),
    ],
  },
  {
    before: [
      l('kerrow', "Fog's in, and the forest is full of something. Scouts first. We don't shoot what we can't see."),
      l('hallam', "And they can't shoot what they can't see. Remember that too."),
    ],
    after: [
      l('kerrow', 'Valley clear. I only jumped twice.'),
      l('grey', "Their scouting has improved. Mine hasn't."),
    ],
  },
  {
    before: [
      l('hallam', 'Two bridges, and Blue waiting on the far bank. One unit on a bridge stops a whole column, so move fast.'),
      l('kerrow', 'Our helicopter can hop the river. Their anti-air is waiting for exactly that.'),
    ],
    after: [
      l('kerrow', "We're across. The engineers are painting the bridges red. Literally."),
      l('orlen', 'Who authorised them to cross the river?'),
      l('grey', "Nobody, General. That's rather the point."),
    ],
  },
  {
    before: [
      l('hallam', 'Strike team only. No factories, no reinforcements, and their cities feed them every turn you wait.'),
      l('kerrow', "So we don't wait. Stay in the dark and run for the HQ."),
    ],
    after: [
      l('kerrow', "HQ taken before breakfast. Blue's sector command is very confused."),
      l('grey', 'I would like to know how a whole strike team walked past my pickets.'),
    ],
  },
  {
    before: [
      l('kerrow', 'Blue has more money, more ground, and every toy in the catalogue.'),
      l('hallam', "And we have a commander on a winning streak. Take the towns early, and keep that heavy tank off your factories."),
    ],
    after: [
      l('hallam', 'The valley road is open. One more push.'),
      l('orlen', "Major Grey. Hold Crossfire Valley. I don't care what it costs."),
      l('grey', 'Understood, General. It will cost a great deal.'),
    ],
  },
  {
    before: [
      l('kerrow', 'This is it, Commander. The whole valley, fog to the ridgelines, and a war chest three times ours.'),
      l('grey', 'No tricks today, Red. Just you, me, and the valley.'),
      l('hallam', 'Whatever happens out there today, Commander, it has been an honour.'),
    ],
    after: [
      l('kerrow', "The valley's ours. The flag goes up over the old HQ tonight."),
      l('hallam', 'Well done. Now we take the war to them.'),
      l('grey', "Withdrawing across the rivers. This isn't over."),
    ],
  },

  // ----- Act II — Counteroffensive -----
  {
    before: [
      l('hallam', "Two rivers, four bridges, towns on the far bank. Blue is richer, so we out-grab them. Hold nine buildings."),
      l('kerrow', 'Recon to the bridges first. Infantry right behind.'),
    ],
    after: [
      l('kerrow', 'Nine flags on the far bank. The front just moved a whole river.'),
      l('orlen', 'Then build a new front, Major!'),
    ],
  },
  {
    before: [
      l('kerrow', 'Our forward column is cut off in the old citadel. Two gaps in the mountains, and fog everywhere.'),
      l('hallam', 'No relief until day 7. Plug the gaps. A bazooka in a pass is worth three in the open.'),
    ],
    after: [
      l('kerrow', "Day 7, and the gates are still ours. The column's walking out."),
      l('grey', 'A good position, well held. I should have taken it first.'),
    ],
  },
  {
    before: [
      l('kerrow', "Nothing left here to capture and nothing to build. Just what we marched in with."),
      l('hallam', 'Then every trade counts. Finish wounded units; a unit at half health hits at half strength.'),
    ],
    after: [
      l('kerrow', 'Last Blue unit down. The field is quiet.'),
      l('grey', 'An expensive afternoon, for both of us.'),
    ],
  },
  {
    before: [
      l('hallam', 'Blue gunships are raiding our supply lines from a forward airfield. Shut it down.'),
      l('kerrow', 'Anti-air to the front, and more of it as the money comes in.'),
    ],
    after: [
      l('kerrow', "The airfield's quiet. Their pilots left the kettle on."),
      l('orlen', 'Those helicopters were a gift from the Treasury, Major.'),
      l('grey', 'Then the Treasury may send a sympathy card.'),
    ],
  },
  {
    before: [
      l('kerrow', 'Fog, snow, and Blue holding more towns than we do.'),
      l('hallam', 'This is the grind. Scout, spread out, grab every town, and hold the forests.'),
    ],
    after: [
      l('kerrow', 'Spring came early, sir. So did our flags.'),
      l('hallam', "Their citadel is next. Rest the troops."),
    ],
  },
  {
    before: [
      l('grey', "Walls, guns, and everything we have left. You'll have earned it if you take it."),
      l('hallam', 'Screen the gunships, out-range the guns, bazookas on the armor. Keep one foot soldier alive for the HQ.'),
      l('kerrow', 'This could end the war, Commander.'),
    ],
    after: [
      l('kerrow', 'The citadel has fallen. Blue high command... was not in it.'),
      l('hallam', "Orlen fled to the coast with what's left of their army. It isn't over."),
    ],
  },

  // ----- Act III — Endgame -----
  {
    before: [
      l('kerrow', "Blue's remnants are dug in along the coast. The front runs the whole width of the map."),
      l('hallam', "You can't be strong everywhere. Pick a wing and hit it."),
    ],
    after: [
      l('kerrow', 'Coast road open. You can smell the sea from here.'),
      l('orlen', 'Every soldier to the hill town. Every one!'),
    ],
  },
  {
    before: [
      l('kerrow', 'A walled town with one gate and farms all around. Hold eight buildings and the province is ours.'),
      l('grey', "I'll be trying the same thing, Commander. Let's see who's quicker."),
    ],
    after: [
      l('grey', "The hill is yours. I'm running out of hills."),
      l('kerrow', "She's running out of army, too."),
    ],
  },
  {
    before: [
      l('kerrow', 'A crossroads town at dusk. Small map, fast roads, contact by turn two.'),
      l('hallam', 'Blue has twice our money. Hold the centre city and trade only from cover.'),
    ],
    after: [
      l('kerrow', 'Crossroads held. That was the last road to their capital.'),
      l('grey', 'General, we should talk terms.'),
      l('orlen', 'We should talk about your replacement, Major.'),
    ],
  },
  {
    before: [
      l('hallam', 'One bridge to the peninsula, and the whole Blue army on the far bank. The relief fleet arrives on day 9.'),
      l('kerrow', 'Bazookas and anti-air on the bridge, artillery behind. And this time we can build.'),
    ],
    after: [
      l('kerrow', 'Day 9, and sails on the horizon. The bridge held.'),
      l('orlen', 'Throw everything at them, Grey!'),
      l('grey', 'I did, General. That was everything.'),
    ],
  },
  {
    before: [
      l('kerrow', 'Blue reached the river country first, with three times our money.'),
      l('hallam', 'Then out-run them. Recon to the far bridges, infantry to the island. Ten buildings.'),
    ],
    after: [
      l('kerrow', "Ten flags. Their treasury is buying nothing now but maps of the retreat."),
      l('grey', "Orlen is back in the capital. He won't surrender. I'm sorry, Commander."),
    ],
  },
  {
    before: [
      l('kerrow', 'One road through the mountains, a factory on each flank, and the last Blue army in the field.'),
      l('hallam', 'Mountains stop tanks, not infantry or gunships. Grind them down, then choose your way in.'),
      l('orlen', 'You will never take this city!'),
    ],
    after: [
      l('grey', 'General Orlen has... left. On behalf of Blue, I surrender the capital.'),
      l('hallam', "Accepted. It's over, Commander. Go home."),
      l('kerrow', "I'll put the coffee on."),
    ],
  },

  // ===== Book II — Skies and Seas =====
  // ----- Act I — Landfall -----
  {
    before: [
      l('hallam', 'Commodore Kade kept Blue’s navy out of the surrender. He has taken the islands off the Sapphire Coast.'),
      l('kerrow', 'Our troops can’t swim, sir.'),
      l('hallam', 'That is what the Skylift is for.'),
    ],
    after: [
      l('kerrow', 'First island’s ours. The Skylift pilots want the afternoon off.'),
      l('kade', 'A few soldiers on a rock. Let them have it. For now.'),
    ],
  },
  {
    before: [
      l('grey', 'Commander. Major Grey, formerly of Blue. Kade doesn’t speak for us, and I know this coast.'),
      l('hallam', 'She’s with us now. Barges carry your armour across; the shore is where you land.'),
      l('kerrow', 'And Kade’s artillery is exactly where the shore is.'),
    ],
    after: [
      l('grey', 'Beachhead secured. Kade will be furious.'),
      l('kade', 'A traitor and a barge. Is that the best Red can manage?'),
    ],
  },
  {
    before: [
      l('kerrow', 'Oil country. Refineries pay double, and you can upgrade them to pay even more.'),
      l('hallam', 'Money buys ships. Take the refineries before Kade’s men do.'),
    ],
    after: [
      l('kerrow', 'The pumps are running and the money’s flowing.'),
      l('kade', 'Enjoy the oil, Red. You will still need a navy to use it.'),
    ],
  },
  {
    before: [
      l('hallam', 'We have a port now. Build a navy, Commander. Start small.'),
      l('grey', 'Kade drills rigs everywhere. Only a Cutter can claim one, and they pay well.'),
    ],
    after: [
      l('kerrow', 'Two rigs, one road, and a harbour full of our ships.'),
      l('kade', 'A harbour is a target, Red. I have plenty of targets.'),
    ],
  },

  // ----- Act II — Open Water -----
  {
    before: [
      l('kerrow', 'Nothing but water between us and them. Neither army can walk across.'),
      l('hallam', 'Then the rigs decide it. Hold ten buildings, and whoever rules the sea gets there first.'),
    ],
    after: [
      l('grey', 'The sea lanes are ours. Kade’s supply ships will have to go the long way round.'),
      l('kade', 'I am the long way round.'),
    ],
  },
  {
    before: [
      l('grey', 'Kade has tanks you can’t see. Stealth hulls. I only heard rumours until now.'),
      l('kerrow', 'Lovely. Scouts first, pairs only, and nobody wanders into the reeds alone.'),
    ],
    after: [
      l('kerrow', 'Two ghosts found and finished. The infantry are very pleased with themselves.'),
      l('kade', 'Invisible is not the same as invincible. Noted.'),
    ],
  },
  {
    before: [
      l('hallam', 'Kade’s fleet is at sea, subs in front. You can’t hit what you can’t find.'),
      l('grey', 'Frigates hear submarines. Keep one next to anything you care about.'),
    ],
    after: [
      l('kerrow', 'His fleet is on the bottom. The fish have new neighbours.'),
      l('kade', 'Ships can be rebuilt, Commander. Can your nerve?'),
    ],
  },
  {
    before: [
      l('kerrow', 'Our west-shore garrison is cut off, and Kade has bombers in the air.'),
      l('hallam', 'Anti-air on the approaches, turrets on the gaps. Hold until day 8.'),
    ],
    after: [
      l('kerrow', 'Day 8, and the garrison is still standing. Relief is landing now.'),
      l('grey', 'Kade will be back with more. He always has more.'),
    ],
  },
];
