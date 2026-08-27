"use strict";

const { CHILL_BRO_PERSONA } = require("./chill-bro-persona");

const originalFetch = global.fetch;

if (typeof originalFetch === "function" && !global.__chillBroPersonaHookInstalled) {
  global.__chillBroPersonaHookInstalled = true;
  global.fetch = async function chillBroPersonaFetch(input, init = {}) {
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (url === "https://api.openai.com/v1/responses" && typeof init?.body === "string") {
        const payload = JSON.parse(init.body);
        const instructions = String(payload?.instructions || "");
        if (/You are Chill Bro|Chill Bro/i.test(instructions) && !instructions.includes("CHILL BRO — DEFINITIVE CHARACTER BIBLE")) {
          payload.instructions = `${CHILL_BRO_PERSONA}\n\n${instructions}`;
          init = { ...init, body: JSON.stringify(payload) };
        }
      }
    } catch (error) {
      // Persona injection must never block a legitimate model request.
      console.warn("Chill Bro persona injection skipped:", error?.message || error);
    }
    return originalFetch(input, init);
  };
}

module.exports = {};
