'use strict';

const BY_TYPE = {
  Wedding: {
    budget: [['Venue and tent', 28], ['Catering and drinks', 30], ['Decor and flowers', 12], ['Photo and video', 9], ['Music and entertainment', 7], ['Attire and beauty', 6], ['Invitations and favours', 3], ['Contingency', 5]],
    vendors: [['Venue', 'must', 28], ['Caterer', 'must', 30], ['Photographer', 'must', 9], ['Decorator', 'nice', 12], ['Live band or DJ', 'nice', 7]],
    when: ['Six months before', 'Three months before', 'One month before', 'One week before', 'Event day'],
  },
  Birthday: {
    budget: [['Venue', 25], ['Food and cake', 32], ['Decor', 10], ['Entertainment', 15], ['Photography', 6], ['Favours and gifts', 7], ['Contingency', 5]],
    vendors: [['Venue', 'must', 25], ['Caterer or bakery', 'must', 32], ['Entertainer', 'nice', 15], ['Decorator', 'nice', 10]],
    when: ['Six weeks before', 'Three weeks before', 'One week before', 'Two days before', 'Event day'],
  },
  'Community event': {
    budget: [['Venue and permits', 20], ['Food and water', 25], ['Sound and stage', 15], ['Publicity', 10], ['Volunteer support', 10], ['Safety and insurance', 10], ['Supplies and clean-up', 5], ['Contingency', 5]],
    vendors: [['Venue or ground', 'must', 20], ['Sound and lighting', 'must', 15], ['Caterer', 'nice', 25], ['Printer', 'nice', 10]],
    when: ['Two months before', 'One month before', 'Two weeks before', 'One week before', 'Event day'],
  },
};

/** A sample plan used when no API key is configured, so the interface can still be demonstrated. */
function demoPlan(input) {
  const t = BY_TYPE[input.eventType] || BY_TYPE.Wedding;
  return {
    title: `${input.eventType} for ${input.guests} guests`,
    summary: 'A sample plan that shows the layout. Add a Groq API key on the server to get a plan written for your exact event.',
    budget: t.budget.map(([category, percent]) => ({ category, percent, tips: 'Compare three quotes and ask for bundled pricing.' })),
    timeline: t.when.map(when => ({ when, tasks: ['Confirm the next booking', 'Check the budget against quotes'] })),
    vendors: t.vendors.map(([vendor, priority, estPercent]) => ({ vendor, priority, estPercent, ask: ['What is included in the price?', 'What is your cancellation policy?'] })),
    ideas: [{ type: 'Theme', idea: input.style || 'A warm, simple theme with one signature colour' }, { type: 'Activity', idea: 'A guest memory wall' }],
    risks: ['Weather: keep a covered backup.', 'Overruns: agree prices in writing.'],
  };
}

module.exports = { demoPlan };
