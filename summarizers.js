/**
 * @fileoverview This file contains different summarizer implementations.
 */

// #region Constants
const SYSTEM_PROMPT = `
You are a summarizer that creates clear, concise, short summaries of articles.

You will be given content from a webpage content. Produce a summary written
in the third person, focusing on the main points and key details.

Produce output in plain text.
`;
// #endregion

// #region Types

/**
 * @typedef {Object} DownloadProgressEvent
 * @property {number} loaded - The number of bytes loaded.
 * @property {number} total - The total number of bytes to be loaded.
 * 
 * @typedef {Object} SummarizerOptions
 * @property {(DownloadProgressEvent) => void} [onProgress] - A callback function to handle progress updates.
 * @property {AbortSignal} [signal] - An optional AbortSignal to cancel the operation.
 * 
 * @typedef {"short" | "medium" | "long"} SummaryLength
 * 
 * @typedef {Object} SummarizeOptions
 * @property {AbortSignal} [signal] - An optional AbortSignal to cancel the operation.
 * @property {SummaryLength} [length='medium'] - The desired length of the summary.
 * 
 * @typedef {Object} PromptApiSession
 * @property {(string, SummarizeOptions?) => Promise<string>} prompt - A function to send a prompt to the session.
 * @property {Promise<boolean>} ready - A promise that resolves when the session is ready.
 * 
 * @typedef {Object} ChromeSummarizer
 * @property {(string) => Promise<string>} summarize - A function to summarize the input string.
 * 
 */

// #endregion

// #region Helper Functions

/**
 * Validates the input for the summarizer.
 * @param {string} input - The input string to validate.
 * @returns {void}
 * @throws {TypeError} If the input is not a string.
 * @throws {Error} If the input is an empty string.
 */
function assertValidInput(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string. Received ' + typeof input);
  }
  if (input.length === 0) {
    throw new Error('Input cannot be an empty string.');
  }
}

// #endregion

// region PromptApiSummarizer

/**
 * Generates a prompt for the Prompt API summarizer based on the desired summary length.
 * @param {SummaryLength} length - The desired length of the summary.
 * @param {string} input - The content to summarize.
 * @returns {string} The generated prompt for the summarizer.
 * @throws {Error} If the length is invalid.
 */
function getPromptApiPrompt(length, input) {
  
  switch (length) {
    case 'short':
      return `Summarize this article into a single sentence:\n\n${input}`;
    case 'medium':
      return `Summarize this article into at most five sentences and at most 300 characters:\n\n${input}`;
    case 'long':
      return `Summarize this article into a detailed summary:\n\n${input}`;
    default:
      throw new Error(`Invalid summary length: ${length}`);
  }
}

/**
 * Class representing a summarizer using the Prompt API.
 */
export class PromptApiSummarizer {

  /**
   * @type {PromptApiSession}
   */
  #session;

  /**
   * Creates an instance of PromptApiSummarizer.
   * @param {PromptApiSession} session - The session to use for summarization.
   */
  constructor(session) {
    this.#session = session;
  }

  /**
   * Checks if the Prompt API is available.
   * @returns {Promise<boolean>} True if the summarizer is available, false otherwise.
   */
  static async isAvailable() {
    if (chrome.aiOriginTrial?.languageModel?.availability) {
      const availability = await chrome.aiOriginTrial.languageModel.availability();
      return availability !== "unavailable";
    }
    
    return false;
  }

  /**
   * Creates a new instance of PromptApiSummarizer.
   * @param {SummarizerOptions} options - Options for creating the summarizer.
   * @returns {Promise<PromptApiSummarizer>} A promise that resolves to a new instance of PromptApiSummarizer.
   */
  static async create({ onProgress = () => { }, signal } = {}) {

    if (!await PromptApiSummarizer.isAvailable()) {
      throw new Error('Prompt API is not available.');
    }

    const session = await chrome.aiOriginTrial.languageModel.create({
      systemPrompt: SYSTEM_PROMPT,
      monitor(m) {
        m.addEventListener('downloadprogress', onProgress);
      },
      signal
    });
    
    // when the signal is aborted, destroy the session to free up resources
    signal?.addEventListener('abort', () => {
      session.destroy();
    });
    
    return new PromptApiSummarizer(session);
  }

  /**
   * Summarizes the given input.
   * @param {string} input - The input string to summarize.
   * @param {SummarizeOptions} [options] - Options for summarization.
   * @returns {Promise<string>} A promise that resolves to the summary of the input.
   * @throws {Error} If the session is not initialized or if the input is invalid.
   */
  async summarize(input, { signal, length = 'medium' } = {}) {

    if (!this.#session) {
      throw new Error('Session is not initialized.');
    }

    assertValidInput(input);

    return this.#session.prompt(getPromptApiPrompt(length, input), { signal });
  }
  
  /**
   * Destroys the session, releasing any resources.
   * @returns {void}
   */
  destroy() {
    if (this.#session) {
      this.#session.destroy();
    }
  }
}

// #endregion

// #region NativeSummarizer

/**
 * Class representing a native summarizer.
 */
export class NativeSummarizer {

  #summarizer;

  /**
   * Creates an instance of NativeSummarizer.
   */
  constructor(summarizer) {
    this.#summarizer = summarizer;
  }

  /**
   * Checks if the native summarizer is available.
   * @returns {Promise<boolean>} True if the native summarizer is available, false otherwise.
   */
  static async isAvailable() {
    if (globalThis.Summarizer?.availability) {
      const availability = await globalThis.Summarizer.availability();
      return availability !== "unavailable";
    }
    
    return false;
  }

  /**
   * Creates a new instance of NativeSummarizer.
   * @param {SummarizerOptions} options - Options for creating the summarizer.
   * @returns {Promise<NativeSummarizer>} A promise that resolves to a new instance of NativeSummarizer.
   * @throws {Error} If the native summarizer is not available.
   */
  static async create({ onProgress = () => { }, signal, length = 'medium' } = {}) {
    if (!await NativeSummarizer.isAvailable()) {
      throw new Error('Native summarizer is not available.');
    }

    const summarizer = await globalThis.Summarizer.create({
      format: 'plain-text',
      type: 'tl;dr',
      sharedContext: 'An article from a webpage.',
      length,
      monitor(m) {
        m.addEventListener('downloadprogress', onProgress);
      },
      signal
    });

    // when the signal is aborted, destroy the session to free up resources
    signal?.addEventListener('abort', () => {
      summarizer.destroy();
    });

    return new NativeSummarizer(summarizer);
  }

  /**
   * Summarizes the given input using native methods.
   * @param {string} input - The input string to summarize.
   * @param {SummarizeOptions} [options] - Options for summarization.
   * @returns {Promise<string>} A promise that resolves to the summary of the input.
   * @throws {Error} If the input is invalid.
   */
  async summarize(input, { signal } = {}) {
    
    if (!this.#summarizer) {
      throw new Error('Native summarizer is not initialized.');
    }
    
    assertValidInput(input);
    
    signal?.throwIfAborted();

    return this.#summarizer.summarize(input);
  }
  
  /**
   * Destroys the session, releasing any resources.
   * @returns {void}
   */
  destroy() {
    if (this.#summarizer) {
      this.#summarizer.destroy();
    }
  }
  
}

// #endregion

/**
 * Array of available summarizers ordered by preference.
 * The first available summarizer will be used.
 */
const summarizers = [
  PromptApiSummarizer,
  NativeSummarizer
];

/**
 * Checks if any summarizer is available.
 * @returns {Promise<boolean>} A promise that resolves to true if any summarizer is available, false otherwise.
 */
export async function isSummarizerAvailable() {
  for (const summarizerClass of summarizers) {
    if (await summarizerClass.isAvailable()) {
      return true;
    }
  }
  return false;
}

/**
 * Creates a summarizer instance based on availability.
 * @param {SummarizerOptions} options - Options for creating the summarizer.
 * @returns {Promise<PromptApiSummarizer|NativeSummarizer>} A promise that resolves to an instance of a summarizer.
 * @throws {Error} If no summarizer is available.
 */
export async function createSummarizer({ onProgress = () => { }, signal } = {}) {
  
  for (const summarizerClass of summarizers) {
    if (await summarizerClass.isAvailable()) {
      try {
        // must be return await to catch the error in this function
        return await summarizerClass.create({ onProgress, signal });
      } catch (error) {
        console.warn(`Failed to create summarizer: ${summarizerClass.name}`, error);
      }
    }
  }
  
  // If no summarizer is available, throw an error 
  throw new Error('No summarizer available.');
}
