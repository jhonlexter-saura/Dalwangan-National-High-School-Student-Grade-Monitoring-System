const crypto = require("crypto");
const GradebookLock = require("../models/GradebookLock");

const LOCK_LEASE_MS = 2 * 60 * 1000;

function gradebookLockKey(classId, periodId) {
  return `gradebook:${String(classId)}:${String(periodId)}`;
}

async function acquireGradebookLock(classId, periodId) {
  const resourceKey = gradebookLockKey(classId, periodId);
  const ownerToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_LEASE_MS);

  const expiredLock = await GradebookLock.findOneAndUpdate(
    { resourceKey, expiresAt: { $lte: now } },
    { $set: { ownerToken, expiresAt } },
    { new: true }
  ).lean();

  if (expiredLock) return { resourceKey, ownerToken };

  try {
    await GradebookLock.create({ resourceKey, ownerToken, expiresAt });
    return { resourceKey, ownerToken };
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

async function renewGradebookLock(lock) {
  if (!lock) return false;
  const result = await GradebookLock.updateOne(
    { resourceKey: lock.resourceKey, ownerToken: lock.ownerToken, expiresAt: { $gt: new Date() } },
    { $set: { expiresAt: new Date(Date.now() + LOCK_LEASE_MS) } }
  );
  return result.matchedCount === 1;
}

async function releaseGradebookLock(lock) {
  if (!lock) return;
  await GradebookLock.deleteOne({ resourceKey: lock.resourceKey, ownerToken: lock.ownerToken });
}

module.exports = {
  acquireGradebookLock,
  renewGradebookLock,
  releaseGradebookLock,
  gradebookLockKey,
  LOCK_LEASE_MS,
};
