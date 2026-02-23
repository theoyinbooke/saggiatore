/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authHelpers from "../authHelpers.js";
import type * as batchHelpers from "../batchHelpers.js";
import type * as batchRunner from "../batchRunner.js";
import type * as customEvaluations from "../customEvaluations.js";
import type * as customEvaluationsHelpers from "../customEvaluationsHelpers.js";
import type * as customGalileoEval from "../customGalileoEval.js";
import type * as customGalileoEvalHelpers from "../customGalileoEvalHelpers.js";
import type * as customGenerator from "../customGenerator.js";
import type * as customLeaderboard from "../customLeaderboard.js";
import type * as customMessages from "../customMessages.js";
import type * as customOrchestrator from "../customOrchestrator.js";
import type * as customOrchestratorHelpers from "../customOrchestratorHelpers.js";
import type * as customSessions from "../customSessions.js";
import type * as evaluations from "../evaluations.js";
import type * as galileoEval from "../galileoEval.js";
import type * as galileoEvalHelpers from "../galileoEvalHelpers.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as llmClient from "../llmClient.js";
import type * as messages from "../messages.js";
import type * as modelDiscovery from "../modelDiscovery.js";
import type * as modelRegistry from "../modelRegistry.js";
import type * as orchestrator from "../orchestrator.js";
import type * as orchestratorHelpers from "../orchestratorHelpers.js";
import type * as personas from "../personas.js";
import type * as pythonSdkIngest from "../pythonSdkIngest.js";
import type * as scenarios from "../scenarios.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as settingsAdmin from "../settingsAdmin.js";
import type * as tools from "../tools.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authHelpers: typeof authHelpers;
  batchHelpers: typeof batchHelpers;
  batchRunner: typeof batchRunner;
  customEvaluations: typeof customEvaluations;
  customEvaluationsHelpers: typeof customEvaluationsHelpers;
  customGalileoEval: typeof customGalileoEval;
  customGalileoEvalHelpers: typeof customGalileoEvalHelpers;
  customGenerator: typeof customGenerator;
  customLeaderboard: typeof customLeaderboard;
  customMessages: typeof customMessages;
  customOrchestrator: typeof customOrchestrator;
  customOrchestratorHelpers: typeof customOrchestratorHelpers;
  customSessions: typeof customSessions;
  evaluations: typeof evaluations;
  galileoEval: typeof galileoEval;
  galileoEvalHelpers: typeof galileoEvalHelpers;
  http: typeof http;
  leaderboard: typeof leaderboard;
  llmClient: typeof llmClient;
  messages: typeof messages;
  modelDiscovery: typeof modelDiscovery;
  modelRegistry: typeof modelRegistry;
  orchestrator: typeof orchestrator;
  orchestratorHelpers: typeof orchestratorHelpers;
  personas: typeof personas;
  pythonSdkIngest: typeof pythonSdkIngest;
  scenarios: typeof scenarios;
  seed: typeof seed;
  sessions: typeof sessions;
  settingsAdmin: typeof settingsAdmin;
  tools: typeof tools;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
