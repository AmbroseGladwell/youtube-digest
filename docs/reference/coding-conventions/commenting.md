# Commenting

## Comments shouldn't duplicate signatures

Avoid comments that repeat what can be easily seen from the signature of a method or function. For example:

Bad:

```typescript
/**
 * Gets the favourite colour of the given person.
 * @param person The person.
 * @returns The favourite colour.
 */
const getFavouriteColour = (person: Person): Colour => person.favouriteColour
```

All this information is contained within the signature, so the comment is at best redundant - and at worst might have become stale and inaccurate.

Bad:

```typescript
// Loop through items
for (const item of items) { ... }
```

## Make code self-documenting

Where possible, make code self-documenting rather than add additional comments to explain how it works. This can often be done by choosing good function/method/variable names. For example:

Bad - rather than using a comment to explain the purpose of a block of code:

```typescript
const processOrder = (order: Order, orderDao: OrderDao) => {
  // Calculate the total including tax and shipping
  // tax rate is 20%, shipping is a flat 5 if there are items
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.2
  const shipping = order.items.length > 0 ? 5 : 0
  const total = subtotal + tax + shipping

  order.total = total
  orderDao.updateOrderTotal(order.id, total)
}
```

Good - instead, we could split out a helper function and constants to make it clear by itself:

```typescript
const TAX_RATE = 0.2
const SHIPPING_COST = 5

const processOrder = (order: Order, orderDao: OrderDao) => {
  const total = calculateTotal(order)
  orderDao.updateOrderTotal(order.id, total)
}

const calculateTotal = (order: Order): number => {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * TAX_RATE
  const shipping = order.items.length > 0 ? SHIPPING_COST : 0
  return subtotal + tax + shipping
}
```

A comment can often be a "code smell" - a symptom that the code can be better organised to be more easily understood without needing additional documentation.

## No TODO / FIXME comments

It's easy for these to be forgotten, just creating noise in the codebase. Instead, consider fixing as part of your change, or creating a Jira ticket for the work / bug if it can't be addressed immediately.

Bad:

```typescript
// TODO: refactor this to be less confusing
```

## When are comments useful?

Use comments to include important information that can't be deduced from the code itself. Explain _why_ choices are made, not _what_ the code does.

Good - this comment explains _why_ the header is being added, rather than just _what_ the code is doing. It also includes a link to the issue so that in the future we can easily check if the problem has been addressed:

```typescript
// Workaround: must disable caching manually due to bug in axios on Node 20
// See: https://github.com/axios/axios/issues/5678
const response = await axios.get(url, {
  headers: { 'Cache-Control': 'no-cache' },
})
```
