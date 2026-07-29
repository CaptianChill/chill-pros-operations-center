"use strict";

const assert = require("node:assert/strict");
const { classifyUpdateAction } = require("../app-audited-mutation-bridge.js");

assert.equal(classifyUpdateAction({ internalCost: 125 }), "customer.pricing.updated");
assert.equal(classifyUpdateAction({ estimatedAmount: 850 }), "customer.pricing.updated");
assert.equal(classifyUpdateAction({ priceOverride: true, officeStatus: "Needs Quote" }), "customer.pricing.updated");
assert.equal(classifyUpdateAction({ approvalStatus: "Approved" }), "customer.approval.updated");
assert.equal(classifyUpdateAction({ overrideApprovedBy: "owner-uid" }), "customer.approval.updated");
assert.equal(classifyUpdateAction({ partsOrderStatus: "Ordered" }), "customer.order-status.updated");
assert.equal(classifyUpdateAction({ receivedAt: "2026-07-29T20:00:00.000Z" }), "customer.order-status.updated");
assert.equal(classifyUpdateAction({ assignedTechnician: "Brae" }), "customer.schedule.updated");
assert.equal(classifyUpdateAction({ officeStatus: "Completed" }), "customer.status.updated");
assert.equal(classifyUpdateAction({ findings: "Failed relay" }), "customer.updated");
assert.equal(classifyUpdateAction({}), "customer.updated");

console.log("app audited mutation classification tests passed");
