import test from "node:test";
import assert from "node:assert/strict";
import { speakable } from "./speakable.js";

test("expands the abbreviations and symbols the voice reads badly", () => {
  assert.equal(speakable("Lift heavy, e.g. squats."), "Lift heavy, for example squats.");
  assert.equal(speakable("One goal, i.e. the job."), "One goal, that is the job.");
  assert.equal(speakable("Rent vs buy."), "Rent versus buy.");
  assert.equal(speakable("Bread & butter."), "Bread and butter.");
  assert.equal(speakable("Save 20% a month."), "Save 20 percent a month.");
  assert.equal(speakable("Shoes, bags, etc."), "Shoes, bags, and so on");
});

test("names the currency after the amount, and the magnitude when there is one", () => {
  assert.equal(speakable("Earn $5k more."), "Earn 5 thousand dollars more.");
  assert.equal(speakable("It costs £99."), "It costs 99 pounds.");
  assert.equal(speakable("It costs $1."), "It costs 1 dollar.");
});

test("names the currency in the singular when the amount describes a thing", () => {
  assert.equal(speakable("A £99 course."), "A 99 pound course.");
  assert.equal(speakable("a $600 coat beats a $60 jacket"), "a 600 dollar coat beats a 60 dollar jacket");
  assert.equal(speakable("An €8m fund."), "An 8 million euro fund.");
});

test("drops a parenthetical aside", () => {
  assert.equal(speakable("Rest two minutes (or three) between sets."), "Rest two minutes between sets.");
  assert.equal(speakable("Kleiber (1932) measured it."), "Kleiber measured it.");
});

test("says a multiplication, a power and a simple fraction in words", () => {
  assert.equal(speakable("Leave 8x7 until last."), "Leave 8 times 7 until last.");
  assert.equal(speakable("Pair 4 x 5 with 5x4."), "Pair 4 times 5 with 5 times 4.");
  assert.equal(speakable("It scales as mass^0.75."), "It scales as mass to the power of 0.75.");
  assert.equal(speakable("Heart rate scales as M^-1/4."), "Heart rate scales as M to the power of minus one quarter.");
  assert.equal(speakable("About 1/6 of the dose, or 3/4 of it."), "About one sixth of the dose, or three quarters of it.");
});

test("leaves a date or an odd ratio as it is rather than guessing a fraction", () => {
  assert.equal(speakable("On 3/4/2024."), "On 3/4/2024.");
  assert.equal(speakable("A 24/7 job."), "A 24/7 job.");
});

test("says a thousands suffix, and a 401k as it is named", () => {
  assert.equal(speakable("A 50k salary."), "A 50 thousand salary.");
  assert.equal(speakable("Raise your 401k and your 401(k)."), "Raise your four oh one k and your four oh one k.");
});

test("leaves ordinary prose alone", () => {
  assert.equal(speakable("Add sets, not weight."), "Add sets, not weight.");
});
