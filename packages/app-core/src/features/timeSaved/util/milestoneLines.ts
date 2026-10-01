import type { MilestoneId } from "@overview/domain";

// Five per milestone, three comedy then two facts, in the order the card cycles them
// ("OV-34 4 Lines and Motion"; docs/features/time-saved.md).
export const MILESTONE_LINES: Record<MilestoneId, readonly string[]> = {
  "30m": [
    "About as long as it takes to find the end of the sellotape, lose it again, and settle for a stapler.",
    "About as long as it takes to search the whole house for your keys, which are in your hand.",
    "About as long as “I’ll be two minutes” from someone who hasn’t found their shoes yet.",
    "About as long as it takes Earth to travel over 50,000 km around the Sun, which is more than four Earths laid end to end.",
    "About as long as the Ramones’ debut album, which fits 14 songs into 29 minutes.",
  ],
  "1h": [
    "About as long as a meeting that could have been an email, and the email could have been nothing.",
    "About as long as you spend scrolling for something to watch before rewatching the thing you’ve seen four times.",
    "About as long as a “five minute job” takes once it needs a different screwdriver, a trip to the shop and a YouTube tutorial.",
    "About as long as an NFL game on the clock, in which the ball is in play for only about 11 minutes.",
    "About as long as a sperm whale can stay under on a single breath while hunting squid in the dark.",
  ],
  "5h": [
    "About as long as “I’ll just pop in for a quick cuppa” with a relative who has a lot of news.",
    "About as long as it takes to build a flat-pack wardrobe and then take it apart because step 2 was on page 9.",
    "About as long as a customer service chatbot takes to say “I didn’t quite get that” before passing you to another chatbot.",
    "About as long as flying from London to Cairo (4h 50m), which puts you in front of pyramids around 4,500 years old.",
    "About as long as sunlight takes to reach Pluto (about 5.5 hours), where noon is only as bright as twilight on Earth.",
  ],
  "10h": [
    "About as long as an 8am to 6pm delivery window, which the driver honours by arriving at 5:58 and leaving a card saying you were out.",
    "About as long as a “quick 20 minute nap” that ends with you waking up in the dark, hungry, and unsure what day it is.",
    "About as long as it takes a printer to accept that it’s connected to the wifi. It was. The whole time.",
    "About as long as a day on Jupiter (9h 56m), the shortest day of any planet in our solar system.",
    "About as long as the Isner v Mahut match at Wimbledon in 2010 (11h 5m), which ran so long the scoreboard gave up at 47 all.",
  ],
  "15h": [
    "About as long as a car journey where “nearly there” was first announced at the end of the driveway.",
    "About as long as it takes to recover from a night that started with “I’ll just have the one”.",
    "About as long as a toddler’s “one last story”, which has now become a box set.",
    "About as long as Alcock and Brown’s first nonstop flight across the Atlantic in 1919 (about 16 hours), which ended with a nose-first landing in an Irish bog.",
    "About as long as a cat sleeps on a typical day (12 to 16 hours), which is most of its life.",
  ],
  "20h": [
    "About as long as a family group chat takes to pick a restaurant, where everyone says “anywhere is fine” and vetoes everywhere.",
    "About as long as a long-haul flight where the seat in front has been reclined directly into your face.",
    "About as long as being told “your call is important to us” by a company that has left you on hold since breakfast.",
    "About as long as the longest chess game ever played (20h 15m, 269 moves), which ended in a draw.",
    "About as long as all eight Harry Potter films back to back (19h 39m).",
  ],
  "30h": [
    "About as long as the dishwasher spends on “2 minutes remaining”.",
    "About as long as a “quick scroll” takes before you’re watching a stranger restore a rusty spade.",
    "About as long as it takes to untangle the fairy lights you “carefully” packed away last year.",
    "About as long as Concorde took to fly round the world in 1995 (about 31.5 hours), stops included.",
    "About as long as Gordon Cooper’s 1963 spaceflight (about 34 hours), which began with him dozing off on the launch pad.",
  ],
  "50h": [
    "About as long as clean laundry stays on the chair “just for tonight”, until the chair is officially a wardrobe.",
    "About as long as a progress bar spends on 99%, while you stare at it as if that helps.",
    "About as long as it takes to find the one cable you kept “for exactly this”, in a drawer of 40 cables that fit nothing.",
    "About as long as all 25 Bond films back to back (about 53 hours).",
    "About as long as the 1939 “Timeless Test” cricket match in Durban (43 hours of play), which was called off as a draw so England could catch their boat home.",
  ],
  "75h": [
    "About as long as a “bit of a cold” takes to be described, in full, as the worst illness in human history.",
    "About as long as a “sale ends Sunday” email takes to become “last chance”, then “actually last chance”, then “we lied”.",
    "About as long as a “quick pop to the shops” with a toddler who insists on saying hello to every dog, pigeon and puddle.",
    "About as long as Apollo 11 took to reach lunar orbit (just under 76 hours), roughly a long weekend away.",
    "About as long as the winner of the Tour de France spends racing across three weeks (around 80 hours).",
  ],
  "100h": [
    "About as long as Christmas leftovers last: turkey sandwich, turkey soup, turkey curry, turkey regret.",
    "About as long as a password reset: “must include a capital, a number, a symbol and a small piece of your soul”.",
    "About as long as it takes the plant you were “definitely going to water” to file a formal complaint.",
    "About as long as the International Space Station needs to fly to the Moon and back about three and a half times.",
    "Not far off every episode of Friends back to back (about 86 hours).",
  ],
};
