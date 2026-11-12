import test from "node:test";
import assert from "node:assert/strict";
import { methodTimes, timerName } from "./methodTimes.js";

const read = (text: string) =>
  methodTimes(text).map((time) => ({ words: text.slice(time.start, time.end), seconds: [...time.seconds], name: time.name }));

test("a time in minutes, with the verb it waits on", () => {
  assert.deepEqual(read("Spoon it into the tin and bake for 45 minutes, until a skewer comes out clean."), [
    { words: "45 minutes", seconds: [2700], name: "Bake" },
  ]);
});

test("the forms a time is written in", () => {
  const seconds = (text: string) => methodTimes(text).map((time) => [...time.seconds]);
  assert.deepEqual(seconds("Cook for 1 hour."), [[3600]]);
  assert.deepEqual(seconds("Cook for 1½ hours."), [[5400]]);
  assert.deepEqual(seconds("Cook for 1 1/2 hours."), [[5400]]);
  assert.deepEqual(seconds("Cook for 1.5 hours."), [[5400]]);
  assert.deepEqual(seconds("Cook for 1 and a half hours."), [[5400]]);
  assert.deepEqual(seconds("Cook for half an hour."), [[1800]]);
  assert.deepEqual(seconds("Cook for an hour."), [[3600]]);
  assert.deepEqual(seconds("Cook for a minute."), [[60]]);
  assert.deepEqual(seconds("Cook for ten minutes."), [[600]]);
  assert.deepEqual(seconds("Cook for forty-five minutes."), [[2700]]);
  assert.deepEqual(seconds("Cook for 1 hour 15 minutes."), [[4500]]);
  assert.deepEqual(seconds("Cook for 2 hours and 30 minutes."), [[9000]]);
  assert.deepEqual(seconds("Cook for 1 hr 15 mins."), [[4500]]);
  assert.deepEqual(seconds("Cook for 1 hr 15."), [[4500]]);
  assert.deepEqual(seconds("Cook for 1h15."), [[4500]]);
  assert.deepEqual(seconds("Cook for 1h 15m."), [[4500]]);
  assert.deepEqual(seconds("Cook for 20 mins."), [[1200]]);
  assert.deepEqual(seconds("Cook for 20min."), [[1200]]);
  assert.deepEqual(seconds("Whisk for 30 seconds."), [[30]]);
  assert.deepEqual(seconds("Whisk for 30 secs."), [[30]]);
  assert.deepEqual(seconds("Whisk for 30s."), [[30]]);
  assert.deepEqual(seconds("Give it a 30-minute rest."), [[1800]]);
  assert.deepEqual(seconds("Turn the cake over and cook for 5 more minutes."), [[300]]);
});

test("a range gives both its ends", () => {
  assert.deepEqual(read("Knead for 8–10 minutes, until smooth and springy."), [
    { words: "8–10 minutes", seconds: [480, 600], name: "Knead" },
  ]);
  assert.deepEqual(read("Cover and leave somewhere warm for 1 to 1½ hours, until doubled."), [
    { words: "1 to 1½ hours", seconds: [3600, 5400], name: "Leave" },
  ]);
  assert.deepEqual(read("Fry for 10 or 12 minutes."), [{ words: "10 or 12 minutes", seconds: [600, 720], name: "Fry" }]);
  assert.deepEqual(read("Roast for 45 minutes to 1 hour."), [{ words: "45 minutes to 1 hour", seconds: [2700, 3600], name: "Roast" }]);
  assert.deepEqual(read("Simmer for 2-3 mins."), [{ words: "2-3 mins", seconds: [120, 180], name: "Simmer" }]);
});

test("two times in one action are found apart, each named by its own verb", () => {
  assert.deepEqual(read("Simmer for 10 minutes, stirring now and again, and rest it off the heat for 5 minutes."), [
    { words: "10 minutes", seconds: [600], name: "Simmer" },
    { words: "5 minutes", seconds: [300], name: "Rest" },
  ]);
});

test("the verb is the command before the time, not any verb near it", () => {
  assert.equal(timerName("Boil the blend in a wide pot until most of the water has cooked off and it has thickened, about "), "Boil");
  assert.equal(timerName("Warm the naan in the oven, wrapped in foil, for "), "Warm");
  assert.equal(timerName("Let it rest for "), "Rest");
  assert.equal(timerName("Leave to rise for "), "Rise");
  assert.equal(timerName("Then gently simmer for "), "Simmer");
  assert.equal(timerName("The fish is done once it has cooked through, about "), "Cook");
  assert.equal(timerName("Put the lid on for "), null);
  assert.equal(timerName("Pour off the juices and mix with barbecue sauce. Baste the chicken and return to the oven for "), null);
  assert.equal(timerName("Bring to a gentle simmer and let cook for "), "Cook");
});

test("times that aren't a wait stay unmarked", () => {
  for (const text of [
    "Serve within 30 minutes of making.",
    "Stir every 5 minutes.",
    "It keeps for 2 weeks in the fridge.",
    "Make up to 3 days ahead.",
    "Marinate for 48 hours.",
    "Serve at 6:30.",
    "Heat a 20cm frying pan.",
    "Add 200g butter.",
    "Divide it into 4 pieces.",
    "Fry for a few minutes.",
  ]) {
    assert.deepEqual(methodTimes(text), [], text);
  }
});

test("a number inside a word or a longer number isn't a time", () => {
  assert.deepEqual(methodTimes("Cook until tender."), []);
  assert.deepEqual(methodTimes("Add the tenth one."), []);
});
