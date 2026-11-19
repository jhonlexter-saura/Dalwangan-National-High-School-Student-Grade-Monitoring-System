## The mental model

Each layer has one job:

| Layer | Job | Question it answers |
|---|---|---|
| **Route** | Map URL and method to a chain of functions | "Which URL runs what, in what order?" |
| **Middleware** | Check or prepare the request before the handler | "Is this request acceptable?" |
| **Controller** | Do the work: query the DB, apply rules, respond | "What should happen?" |

The finished route file (`routes/academicPeriods.js`) is just a table of contents:

```js
router.patch("/:id", requireAdmin, validatePeriodId, validatePeriodBody, controller.updatePeriod);
```

You read it left to right. Express runs each function in order, and each one either stops the request with an error response or calls `next()`.

## The steps, for any route file

**1. Sort every block of code into one of three buckets.**
- Rejects bad input without touching the DB (`isValidObjectId`, `validatePeriod`): middleware.
- Everything inside `router.get(..., async (req, res) => { ... })`: controller.
- Reads the DB to check a business rule (`findCalendarConflict`, "has activities"): controller, because it needs the database and the existing record.

That last point is why I did not move `findCalendarConflict` or the "cannot change school year" checks into middleware. They depend on data in the DB, not just on the request shape. A good rule: **if you only need `req` to decide, it's middleware. If you need a query, it's the controller.**

**2. Move the validation, and have it hand its result forward.**
In `academicPeriodValidation.js`, the old `validatePeriod` function is unchanged. I wrapped it in `validatePeriodBody`:

```js
req.periodData = result;
next();
```

The middleware stores the cleaned data on `req`. The controller then reads `req.periodData` and never touches the raw `req.body`. This also explains the order of `validatePeriodId` and `validatePeriodBody` in the PATCH route. It matches the original, which checked the ID first and the body second.

**3. Pull out repeated checks into generic middleware.**
The ObjectId check appeared in PATCH and DELETE. `validateObjectId("id", "message")` is a factory: a function that returns a middleware. Put it once in `middleware/validateObjectId.js` and reuse it in all 14 files.

**4. Turn each route callback into a named function.**
`router.post("/", requireAdmin, async (req, res) => {...})` becomes `async function createPeriod(req, res) {...}`, exported from the controller. Copy the body, delete the validation lines at the top (they're in the middleware now), and swap `periodData = validatePeriod(...)` for `req.periodData`.

**5. Extract duplicated code into helpers.**
POST and PATCH both had the same "make other active periods completed" block. It is now `completeOtherActivePeriods(period)`. Whenever you copy-paste inside a controller, make a helper.

**6. Re-point the imports.**
Each file should import only what it uses. The route file no longer imports `mongoose`, the models, or `logAudit`. If an import is unused, delete it.

## Checklist for each of the 14 files

1. List the routes (method, path, middleware already on them).
2. Mark each line as validation, DB or business logic, or response.
3. Create `controllers/xController.js` and move the handlers.
4. Create `middleware/validators/xValidation.js` and move the validation.
5. Replace the route file's body with the one-line-per-route table.
6. Test every endpoint, including the error cases. Behavior should be identical to before.

## Small things I noticed (I left behavior unchanged)

- The "required" error message mentions trimester, but the check above it doesn't test for it. The later trimester check catches it, so it still works, just with a different message.
- PATCH requires the full body, so it behaves like PUT. This is fine, but you could allow partial updates later.
- `GET /` runs 2 queries per period inside a loop. For a few terms this is fine, but it is the kind of thing a teacher may ask about.

If you want to try the next file yourself, send me your version and I'll review it against this pattern.