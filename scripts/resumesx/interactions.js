// Click behaviour that lives on the components themselves, so every instance gets it.
//
//   node run.js icons.js lib.js interactions.js      (after components.js)
//
// DeleteButton: the first click arms it and it disarms after 2.5 seconds, as in
// ApplicationsTable.tsx. The second click is left unwired: a prototype cannot delete a row.
// FilterChip: a click switches it on or off. The table does not filter in a prototype.

async function variantOf(setName, variantName) {
  var set = await component(setName);
  return set.children.filter(function (c) { return c.name === variantName; })[0];
}

async function changeTo(from, to, trigger) {
  await from.setReactionsAsync([{ trigger: trigger, actions: [{ type: 'NODE', destinationId: to.id, navigation: 'CHANGE_TO', transition: null, resetScrollPosition: false }] }]);
}

var resting = await variantOf('DeleteButton', 'armed=false');
var armed = await variantOf('DeleteButton', 'armed=true');
await changeTo(resting, armed, { type: 'ON_CLICK' });
await changeTo(armed, resting, { type: 'AFTER_TIMEOUT', timeout: 2.5 });

var on = await variantOf('FilterChip', 'active=true');
var off = await variantOf('FilterChip', 'active=false');
await changeTo(off, on, { type: 'ON_CLICK' });
await changeTo(on, off, { type: 'ON_CLICK' });

return { deleteButton: resting.reactions.length + armed.reactions.length, filterChip: on.reactions.length + off.reactions.length };
